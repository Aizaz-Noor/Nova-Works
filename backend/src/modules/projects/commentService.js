import {notifyTaskComment} from '../../platform/notifications.js';
import {ensureSqliteRequestLimits} from '../../services/requestLimits.js';
import {createHash,randomUUID} from 'node:crypto';
import {createPlatformService} from '../../platform/service.js';
import {requireBillingFeature} from '../../platform/billing/policy.js';
import {ApiError} from '../../middleware/errorHandler.js';
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function createCommentService(db,{clock=()=>Date.now()}={}){
 ensureSqliteRequestLimits(db);
 const platform=createPlatformService(db),prefix=db.kind==='postgres'?'novaworks.':'',table=prefix+'platform_task_comments';
 async function access(c,taskId){
  if(!uuid(taskId))fail(400,'BAD_INPUT','Invalid task ID');
  const task=(await c.query(`SELECT t.assignee_id,p.manager_id FROM ${prefix}platform_tasks t JOIN ${prefix}platform_projects p ON p.organization_id=t.organization_id AND p.id=t.project_id WHERE t.organization_id=? AND t.id=?`,[c.organizationId,taskId])).rows[0];
  if(!task)fail(404,'NOT_FOUND','Task not found');
  if(!['OWNER','ADMIN'].includes(c.member.role)&&!(c.member.role==='MANAGER'&&task.manager_id===c.userId)&&!(c.member.role==='MEMBER'&&task.assignee_id===c.userId))fail(404,'NOT_FOUND','Task not found');
  return task;
 }
 return {
  list(userId,organizationId,taskId,filters={}){return platform.transaction(userId,organizationId,async c=>{
   await access(c,taskId);await requireBillingFeature(db,c,'projects');
   if(Object.keys(filters).some(k=>!['page','limit'].includes(k)))fail(400,'BAD_INPUT','Unsupported comment filter');
   const page=filters.page===undefined?1:Number(filters.page),limit=filters.limit===undefined?25:Number(filters.limit);
   if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100)fail(400,'BAD_INPUT','Invalid comment pagination');
   const args=[organizationId,taskId],total=Number((await c.query(`SELECT COUNT(*) AS total FROM ${table} WHERE organization_id=? AND task_id=?`,args)).rows[0].total);
   const comments=(await c.query(`SELECT id,task_id,author_id,body,created_at FROM ${table} WHERE organization_id=? AND task_id=? ORDER BY created_at,id LIMIT ? OFFSET ?`,[...args,limit,(page-1)*limit])).rows;
   return {comments,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};
  },{snapshot:true});},
  create(userId,organizationId,taskId,input){return platform.transaction(userId,organizationId,async c=>{
   const target=await access(c,taskId);await requireBillingFeature(db,c,'projects',{write:true});
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['body','requestId'].includes(k))||!uuid(input.requestId)||typeof input.body!=='string'||!input.body.trim()||input.body.length>5000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.body))fail(400,'BAD_INPUT','Comment text (1–5000 characters) and a request ID are required');
   const body=input.body.trim(),requestId=input.requestId.toLowerCase();
   if(db.kind==='postgres')await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[`comment-author:${organizationId}:${userId}`]);
   const old=(await c.query(`SELECT id,task_id,author_id,body,created_at FROM ${table} WHERE organization_id=? AND author_id=? AND request_id=?`,[organizationId,userId,requestId])).rows[0];
   if(old){if(old.task_id!==taskId||old.body!==body)fail(409,'REQUEST_CONFLICT','This request ID was already used for a different comment');return {...old,replayed:true};}
   const time=clock(),bucket='comment:'+createHash('sha256').update(JSON.stringify([organizationId,userId])).digest('hex'),limits=prefix+'request_limits';
   const quota=(await c.query(`SELECT count,resets_at FROM ${limits} WHERE bucket=?`,[bucket])).rows[0];
   if(quota&&Number(quota.resets_at)>time&&Number(quota.count)>=30){const error=new ApiError(429,'COMMENT_RATE_LIMITED','Comment limit reached. Wait before posting another note. Your saved comments remain available.');error.retryAfter=Math.max(1,Math.ceil((Number(quota.resets_at)-time)/1000));throw error;}
   await c.query(`INSERT INTO ${limits}(bucket,count,resets_at) VALUES(?,?,?) ON CONFLICT(bucket) DO UPDATE SET count=excluded.count,resets_at=excluded.resets_at`,[bucket,quota&&Number(quota.resets_at)>time?Number(quota.count)+1:1,quota&&Number(quota.resets_at)>time?Number(quota.resets_at):time+600000]);
   const id=randomUUID(),stamp=new Date(time).toISOString();
   await c.query(`INSERT INTO ${table}(organization_id,id,task_id,author_id,request_id,body,created_at) VALUES(?,?,?,?,?,?,?)`,[organizationId,id,taskId,userId,requestId,body,stamp]);
   await c.query(`INSERT INTO ${prefix}platform_audit(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[organizationId,randomUUID(),userId,'task.comment_added',id,stamp]);
   await notifyTaskComment(db,c,{taskId,commentId:id,task:target,at:stamp});
   return {id,task_id:taskId,author_id:userId,body,created_at:stamp,replayed:false};
  });}
 };
}
