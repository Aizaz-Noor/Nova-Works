import {subscriptionState,requireBillingFeature} from '../../platform/billing/policy.js';
import {createHash,randomUUID} from 'node:crypto';
import {createPlatformService} from '../../platform/service.js';
import {extractProjects} from '../../services/aiService.js';
import {validateAiOutput} from '../../validators/aiOutput.js';
import {ApiError} from '../../middleware/errorHandler.js';

const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const productionExtract=(transcript,directory)=>extractProjects(transcript,directory,{company:true});
export function createCompanyAiService(db,{extract=productionExtract,dailyLimit=Number(process.env.COMPANY_AI_DAILY_LIMIT||20),clock=()=>Date.now()}={}){
 if(!Number.isSafeInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)throw new Error('Invalid company AI daily limit');
 const platform=createPlatformService(db),pg=db.kind==='postgres',prefix=pg?'novaworks.':'',t=name=>`${prefix}platform_${name}`;
 const now=()=>new Date(clock()).toISOString();
 const admin=c=>{if(!['OWNER','ADMIN'].includes(c.member.role))fail(403,'ROLE_FORBIDDEN','Company administrator access required');};
 const audit=(c,action,id)=>c.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[c.organizationId,randomUUID(),c.userId,action,id,now()]);
 const transaction=(user,org,work,{maintenance=false}={})=>platform.transaction(user,org,async c=>{
  admin(c);
  // Serialize quota, enqueue and approval across processes. Never hold this lock
  // or a database connection while waiting for a provider response.
  if(pg)await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[`company-ai:${org}`]);
  return work(c);
 },{billingMaintenance:maintenance});
 const directory=async c=>(await c.query(`SELECT m.user_id AS id,m.role,u.name FROM ${t('memberships')} m JOIN ${prefix}users u ON u.id=m.user_id WHERE m.organization_id=? AND m.status='ACTIVE' ORDER BY m.user_id`,[c.organizationId])).rows;
 const row=async(c,id)=>{const value=(await c.query(`SELECT * FROM ${t('ai_jobs')} WHERE organization_id=? AND id=?`,[c.organizationId,id])).rows[0];if(!value)fail(404,'NOT_FOUND','AI job not found');return value;};
 const safe=(r,detail=false)=>({...(detail?{transcript:r.transcript}:{}),id:r.id,status:r.discarded_at?'DISCARDED':r.status,discardedAt:r.discarded_at||null,discardReason:r.discard_reason||null,redactedAt:r.redacted_at||null,version:r.version,attempts:r.attempts,createdAt:r.created_at,updatedAt:r.updated_at,errorCode:r.error_code,draft:r.draft_json?JSON.parse(r.draft_json):null,issues:r.issues_json?JSON.parse(r.issues_json):[],result:r.result_json?JSON.parse(r.result_json):null,retryable:!r.discarded_at&&!r.redacted_at&&(r.status==='FAILED'||r.status==='QUEUED'||r.status==='RUNNING'&&r.lease_until<=now())});
 return {
  enqueue(user,org,input){
   const transcript=typeof input?.transcript==='string'?input.transcript.replaceAll('\r\n','\n').trim():'';
   if(!transcript||transcript.length>30000||transcript.includes('\0')||typeof input?.requestId!=='string'||!input.requestId.trim()||input.requestId.length>100)fail(400,'BAD_INPUT','Provide a request ID and 1–30000 transcript characters without NUL');
   return transaction(user,org,async c=>{
    const old=(await c.query(`SELECT * FROM ${t('ai_jobs')} WHERE organization_id=? AND request_id=?`,[org,input.requestId])).rows[0];
    if(old){if(old.request_hash!==hash(transcript))fail(409,'REQUEST_REUSED','This request ID belongs to another transcript');return {...safe(old),replayed:true};}
    // Bound outstanding retained work as well as provider attempts.
    const pending=(await c.query(`SELECT COUNT(*) AS n FROM ${t('ai_jobs')} WHERE organization_id=? AND status IN ('QUEUED','RUNNING','REVIEW')`,[org])).rows[0];
    if(Number(pending.n)>=50)fail(429,'AI_QUEUE_FULL','Review or approve existing jobs before adding more');
    const id=randomUUID(),stamp=now();
    await c.query(`INSERT INTO ${t('ai_jobs')}(organization_id,id,request_id,request_hash,transcript,created_by,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'QUEUED',?,?)`,[org,id,input.requestId,hash(transcript),transcript,user,stamp,stamp]);
    await audit(c,'ai.queued',id);return {...safe(await row(c,id),true),replayed:false};
   });
  },
  get(user,org,id){return transaction(user,org,async c=>safe(await row(c,id),true));},
  list(user,org,{page=1,limit=20}={}){page=Number(page);limit=Number(limit);if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100)fail(400,'BAD_INPUT','Invalid pagination');return transaction(user,org,async c=>{
   const jobs=(await c.query(`SELECT * FROM ${t('ai_jobs')} WHERE organization_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,[org,limit,(page-1)*limit])).rows;
   const total=Number((await c.query(`SELECT COUNT(*) AS n FROM ${t('ai_jobs')} WHERE organization_id=?`,[org])).rows[0].n);
   const state=await subscriptionState(db,c.query,org),effectiveLimit=state.enabled?Math.min(dailyLimit,state.limits?.aiDaily||0):dailyLimit;
   const day=now().slice(0,10),usage=(await c.query(`SELECT attempts FROM ${t('ai_usage')} WHERE organization_id=? AND day=?`,[org,day])).rows[0];
   return {jobs:jobs.map(job=>safe(job)),pagination:{page,limit,total},usage:{day,attempts:Number(usage?.attempts||0),limit:effectiveLimit}};
  });},
  async run(user,org,id,{automatic=false}={}){
   const claim=await transaction(user,org,async c=>{
    const job=await row(c,id);
    if(job.discarded_at||job.redacted_at)fail(409,'AI_DISCARDED','This meeting was discarded or its content was removed');
    if(automatic&&job.status==='FAILED')fail(409,'AI_NOT_QUEUED','Failed jobs require an administrator retry');
    if(automatic&&job.attempts>=3&&job.status==='RUNNING'&&job.lease_until<=now()){
     await c.query(`UPDATE ${t('ai_jobs')} SET status='FAILED',lease_token=NULL,lease_until=NULL,error_code='AI_RETRY_LIMIT',version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[now(),org,id]);
     await audit(c,'ai.retry_limit',id);return {replay:safe(await row(c,id),true)};
    }
    if(['REVIEW','APPROVED'].includes(job.status))return {replay:safe(job,true)};
    if(job.status==='RUNNING'&&job.lease_until>now())fail(409,'AI_BUSY','This job is already processing');
    const entitlement=await requireBillingFeature(db,c,'ai',{write:true}),effectiveLimit=entitlement.enabled?Math.min(dailyLimit,entitlement.limits?.aiDaily||0):dailyLimit;
    const day=now().slice(0,10);
    await c.query(`INSERT INTO ${t('ai_usage')}(organization_id,day,attempts) VALUES(?,?,0) ON CONFLICT(organization_id,day) DO NOTHING`,[org,day]);
    const usage=(await c.query(`SELECT attempts FROM ${t('ai_usage')} WHERE organization_id=? AND day=?`,[org,day])).rows[0];
    if(Number(usage.attempts)>=effectiveLimit)fail(429,'AI_QUOTA','Company daily AI attempt limit reached; retry after 00:00 UTC');
    const token=randomUUID(),team=await directory(c);
    await c.query(`UPDATE ${t('ai_usage')} SET attempts=attempts+1 WHERE organization_id=? AND day=?`,[org,day]);
    await c.query(`UPDATE ${t('ai_jobs')} SET status='RUNNING',attempts=attempts+1,version=version+1,lease_token=?,lease_until=?,error_code=NULL,updated_at=? WHERE organization_id=? AND id=?`,[token,new Date(clock()+120000).toISOString(),now(),org,id]);
    await audit(c,'ai.started',id);return {token,team,transcript:job.transcript};
   });
   if(claim.replay)return claim.replay;
   let draft,issues=[],errorCode=null;
   try{
    draft=await extract(claim.transcript,claim.team);
    // Keep provider output bounded and JSON-safe before retaining it for review.
    const encoded=JSON.stringify(draft);
    if(!encoded||Buffer.byteLength(encoded)>200000)fail(502,'AI_INVALID_RESPONSE','AI output exceeded the review limit');
    draft=JSON.parse(encoded);
    try{draft=validateAiOutput(draft,claim.team,{company:true});}catch(error){if(error.code!=='INVALID_AI_OUTPUT')throw error;issues=error.issues;}
   }catch(error){errorCode=['AI_NOT_CONFIGURED','AI_PROVIDER_ERROR','AI_TIMEOUT','AI_TRUNCATED','INVALID_AI_OUTPUT','AI_INVALID_RESPONSE'].includes(error.code)?error.code:'AI_PROVIDER_ERROR';}
   return transaction(user,org,async c=>{
    const job=await row(c,id);
    if(job.status!=='RUNNING'||job.lease_token!==claim.token||job.lease_until<=now())fail(409,'AI_LEASE_EXPIRED','Processing lease expired; reload and retry the job');
    await c.query(`UPDATE ${t('ai_jobs')} SET status=?,draft_json=?,issues_json=?,lease_token=NULL,lease_until=NULL,error_code=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[errorCode?'FAILED':'REVIEW',errorCode?null:JSON.stringify(draft),JSON.stringify(issues),errorCode,now(),org,id]);
    await audit(c,errorCode?'ai.failed':'ai.review_ready',id);return safe(await row(c,id),true);
   },{maintenance:true});
  },
  pending(user,org,limit=5){return transaction(user,org,async c=>(await c.query(`SELECT id FROM ${t('ai_jobs')} WHERE organization_id=? AND discarded_at IS NULL AND redacted_at IS NULL AND (status='QUEUED' OR (status='RUNNING' AND lease_until<=?)) ORDER BY created_at,id LIMIT ?`,[org,now(),limit])).rows);},
  discard(user,org,id,input){return transaction(user,org,async c=>{
   const job=await row(c,id);if(job.discarded_at)return {...safe(job,true),replayed:true};
   if(job.status==='APPROVED')fail(409,'AI_APPROVED','Approved delivery records cannot be discarded here');
   if(input?.version!==job.version)fail(409,'VERSION_CONFLICT','This meeting changed; reload before discarding');
   const reason=typeof input.reason==='string'?input.reason.trim():'';if(!reason||reason.length>500||reason.includes('\0'))fail(400,'BAD_INPUT','Provide a discard reason up to 500 characters without NUL');
   await c.query(`UPDATE ${t('ai_jobs')} SET status='FAILED',discarded_at=?,discard_reason=?,lease_token=NULL,lease_until=NULL,error_code=NULL,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[now(),reason,now(),org,id]);
   await audit(c,'ai.discarded',id);return {...safe(await row(c,id),true),replayed:false};
  },{maintenance:true});},
  redact(user,org,id,input){return transaction(user,org,async c=>{
   const job=await row(c,id);if(job.redacted_at)return {...safe(job,true),replayed:true};
   if(job.status!=='APPROVED'&&!job.discarded_at)fail(409,'AI_NOT_CLOSED','Approve or discard the meeting before removing its content');
   if(input?.version!==job.version)fail(409,'VERSION_CONFLICT','This meeting changed; reload before removing content');
   const original=job.result_json?JSON.parse(job.result_json):null;
   const result=original?{projects:[],projectIds:original.projects.map(p=>p.id),projectCount:original.projectCount,taskCount:original.taskCount}:null;
   await c.query(`UPDATE ${t('ai_jobs')} SET transcript='',draft_json=NULL,issues_json=NULL,result_json=?,discard_reason=NULL,redacted_at=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[result?JSON.stringify(result):null,now(),now(),org,id]);
   await audit(c,'ai.content_removed',id);return {...safe(await row(c,id),true),replayed:false};
  },{maintenance:true});},
  approve(user,org,id,input){return transaction(user,org,async c=>{
   const job=await row(c,id);
   if(job.status==='APPROVED')return {...safe(job),replayed:true};
   if(job.status!=='REVIEW')fail(409,'AI_NOT_REVIEWABLE','Complete extraction before approval');
   if(!Number.isSafeInteger(input?.version)||input.version!==job.version)fail(409,'VERSION_CONFLICT','This draft changed; reload before approving');
   const draft=validateAiOutput(input.draft,await directory(c),{company:true}),projects=[];
   let taskCount=0;
   for(const p of draft.projects){
    const projectId=randomUUID();
    await c.query(`INSERT INTO ${t('projects')}(organization_id,id,name,client_name,description,manager_id,deadline,created_at) VALUES(?,?,?,?,?,?,?,?)`,[org,projectId,p.name,p.clientName,p.description,p.managerId,p.deadline,now()]);
    for(const task of p.tasks){await c.query(`INSERT INTO ${t('tasks')}(organization_id,id,project_id,title,description,assignee_id,deadline,estimated_hours,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,[org,randomUUID(),projectId,task.title,task.description,task.assigneeId,task.deadline,task.estimatedHours,now()]);taskCount++;}
    projects.push((await c.query(`SELECT * FROM ${t('projects')} WHERE organization_id=? AND id=?`,[org,projectId])).rows[0]);
   }
   await c.query(`UPDATE ${t('ai_jobs')} SET status='APPROVED',draft_json=?,result_json=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[JSON.stringify(draft),JSON.stringify({projects,projectCount:projects.length,taskCount}),now(),org,id]);
   await audit(c,'ai.approved',id);return {...safe(await row(c,id),true),replayed:false};
  });}
 };
}
