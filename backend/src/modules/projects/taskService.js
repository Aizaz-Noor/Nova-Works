import {randomUUID} from 'node:crypto';
import {createPlatformService} from '../../platform/service.js';
import {ApiError} from '../../middleware/errorHandler.js';
import {validDate} from '../../validators/aiOutput.js';

const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const text=(value,label,max=5000)=>typeof value==='string'&&value.trim()&&value.length<=max&&!value.includes('\0')?value.trim():fail(400,'BAD_INPUT',`${label} is required (maximum ${max} characters)`);
const statuses=['TODO','IN_PROGRESS','DONE'];
export function createTaskService(db){
 const platform=createPlatformService(db),prefix=db.kind==='postgres'?'novaworks.':'';
 const tasks=prefix+'platform_tasks',projects=prefix+'platform_projects',members=prefix+'platform_memberships';
 const audit=(context,action,id)=>context.query(`INSERT INTO ${prefix}platform_audit(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[context.organizationId,randomUUID(),context.userId,action,id,new Date().toISOString()]);
 const manages=(context,project)=>['OWNER','ADMIN'].includes(context.member.role)||(context.member.role==='MANAGER'&&project.manager_id===context.userId);
 async function project(context,id){const row=(await context.query(`SELECT * FROM ${projects} WHERE organization_id=? AND id=?${db.kind==='postgres'?' FOR UPDATE':''}`,[context.organizationId,id])).rows[0];if(!row)fail(404,'NOT_FOUND','Project not found');return row;}
 async function validate(context,input,parent){
  const title=text(input.title,'Task title',200),description=text(input.description,'Task description');
  const assigneeId=text(input.assigneeId,'Assignee',200),deadline=input.deadline;
  if(!(await context.query(`SELECT user_id FROM ${members} WHERE organization_id=? AND user_id=? AND status='ACTIVE'`,[context.organizationId,assigneeId])).rows.length)fail(400,'BAD_ASSIGNEE','Assignee must belong to this company');
  if(!validDate(deadline)||(parent.deadline&&deadline>parent.deadline))fail(400,'BAD_DEADLINE','Use a valid task date on or before the project deadline');
  if(typeof input.estimatedHours!=='number'||!Number.isFinite(input.estimatedHours)||input.estimatedHours<=0)fail(400,'BAD_HOURS','Estimated hours must be a positive finite number');
  return{title,description,assigneeId,deadline,estimatedHours:input.estimatedHours};
 }
 return{
  list(userId,organizationId,filters={}){return platform.transaction(userId,organizationId,async context=>{
   const page=filters.page===undefined?1:Number(filters.page),limit=filters.limit===undefined?50:Number(filters.limit);
   if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100)fail(400,'BAD_INPUT','Invalid task pagination');
   const args=[organizationId],where=['t.organization_id=?'];
   if(context.member.role==='MANAGER'){where.push('p.manager_id=?');args.push(userId);}else if(context.member.role==='MEMBER'){where.push('t.assignee_id=?');args.push(userId);}
   if(filters.projectId){where.push('t.project_id=?');args.push(text(filters.projectId,'Project ID',200));}
   if(filters.status){if(!statuses.includes(filters.status))fail(400,'BAD_INPUT','Invalid task status');where.push('t.status=?');args.push(filters.status);}
   const from=`${tasks} t JOIN ${projects} p ON p.organization_id=t.organization_id AND p.id=t.project_id`;
   const predicate=where.join(' AND ');const total=Number((await context.query(`SELECT COUNT(*) AS total FROM ${from} WHERE ${predicate}`,args)).rows[0].total);
   const rows=(await context.query(`SELECT t.*,p.name AS project_name FROM ${from} WHERE ${predicate} ORDER BY t.deadline,t.id LIMIT ? OFFSET ?`,[...args,limit,(page-1)*limit])).rows;
   return{tasks:rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};
  });},
  create(userId,organizationId,input){return platform.transaction(userId,organizationId,async context=>{
   const parent=await project(context,text(input?.projectId,'Project ID',200));if(!manages(context,parent))fail(403,'ROLE_FORBIDDEN','Only this project manager or a company administrator can assign tasks');
   const value=await validate(context,input,parent),id=randomUUID();
   await context.query(`INSERT INTO ${tasks}(organization_id,id,project_id,title,description,assignee_id,deadline,estimated_hours,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,[organizationId,id,parent.id,value.title,value.description,value.assigneeId,value.deadline,value.estimatedHours,new Date().toISOString()]);
   await audit(context,'task.created',id);return(await context.query(`SELECT * FROM ${tasks} WHERE organization_id=? AND id=?`,[organizationId,id])).rows[0];
  });},
  update(userId,organizationId,id,input){return platform.transaction(userId,organizationId,async context=>{
   const current=(await context.query(`SELECT * FROM ${tasks} WHERE organization_id=? AND id=?`,[organizationId,id])).rows[0];if(!current)fail(404,'NOT_FOUND','Task not found');
   const parent=await project(context,current.project_id),manager=manages(context,parent);
   if(!manager&&!(context.member.role==='MEMBER'&&current.assignee_id===userId))fail(403,'ROLE_FORBIDDEN','You cannot update this task');
   if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).some(key=>!(manager?['title','description','assigneeId','deadline','estimatedHours','status','version']:['status','version']).includes(key)))fail(400,'BAD_INPUT','Unsupported task update');
   const expectedVersion=input.version;if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail(400,'BAD_INPUT','A positive task version is required');
   if(expectedVersion!==current.version||current.version>=2147483647)fail(409,'VERSION_CONFLICT','Task changed; refresh it before saving');
   const status=input.status??current.status;if(!statuses.includes(status))fail(400,'BAD_INPUT','Invalid task status');
   const value=await validate(context,{title:current.title,description:current.description,assigneeId:current.assignee_id,deadline:current.deadline,estimatedHours:current.estimated_hours,...input},parent);
   const changed=await context.query(`UPDATE ${tasks} SET title=?,description=?,assignee_id=?,deadline=?,estimated_hours=?,status=?,version=version+1 WHERE organization_id=? AND id=? AND version=?`,[value.title,value.description,value.assigneeId,value.deadline,value.estimatedHours,status,organizationId,id,expectedVersion]);
   if(changed.changes!==undefined?changed.changes!==1:changed.rowCount!==1)fail(409,'VERSION_CONFLICT','Task changed; refresh it before saving');
   await audit(context,'task.updated',id);return{...current,title:value.title,description:value.description,assignee_id:value.assigneeId,deadline:value.deadline,estimated_hours:value.estimatedHours,status,version:expectedVersion+1};
  });}
 };
}
