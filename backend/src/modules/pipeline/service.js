import { randomUUID } from 'node:crypto';
import { ApiError } from '../../middleware/errorHandler.js';
import { createPlatformService } from '../../platform/service.js';

const roles=['OWNER','ADMIN','MANAGER'],leadStates=['NEW','QUALIFIED','DISQUALIFIED'],stages=['NEW','QUALIFIED','PROPOSAL','WON','LOST'];
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const now=()=>new Date().toISOString();
const has=(o,k)=>Object.hasOwn(o,k);
function text(value,label,max=200,required=false){if(value===undefined&&!required)return '';if(typeof value!=='string'||value.includes('\0')||value.trim().length>max||required&&!value.trim())fail(400,'BAD_INPUT',`${label} must be ${required?'nonempty ':''}text up to ${max} characters without NUL`);return value.trim();}
function input(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(400,'BAD_INPUT','A JSON object with supported fields is required');return value;}
function mail(value){const email=text(value,'Email',254).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'BAD_INPUT','Email must be valid');return email;}
function date(value){if(value===null||value===undefined||value==='')return null;const result=text(value,'Date',10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(Date.parse(result))||new Date(result).toISOString().slice(0,10)!==result)fail(400,'BAD_INPUT','Date must be a real YYYY-MM-DD date');return result;}
function amount(value){if(value===null||value===undefined)return null;if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value)||value.length>16||BigInt(value)>9007199254740991n)fail(400,'BAD_INPUT','Amount must be a canonical integer string from 0 to 9007199254740991, or null');return value;}
function currency(value){if(!['USD','GBP','PKR'].includes(value))fail(400,'BAD_INPUT','Currency must be USD, GBP or PKR');return value;}
function version(value){if(!Number.isSafeInteger(value)||value<1)fail(400,'BAD_INPUT','Current positive integer version is required');return value;}
function normalize(row){return row?{...row,...(has(row,'amount_minor')?{amount_minor:row.amount_minor===null?null:String(row.amount_minor)}:{})}:row;}
function pagination(query){const get=(key,fallback,max)=>{if(query[key]===undefined)return fallback;if(typeof query[key]!=='string'||!/^\d+$/.test(query[key]))fail(400,'BAD_INPUT',`Invalid ${key}`);const number=Number(query[key]);if(!Number.isSafeInteger(number)||number<1||number>max)fail(400,'BAD_INPUT',`Invalid ${key}`);return number;};const page=get('page',1,1000000),limit=get('limit',25,100);return {page,limit,offset:(page-1)*limit};}

export function createPipelineService(db){
 const platform=createPlatformService(db),prefix=db.kind==='postgres'?'novaworks.':'',t=name=>`${prefix}platform_${name}`,lock=db.kind==='postgres'?' FOR UPDATE':'';
 const tx=(userId,orgId,work)=>platform.transaction(userId,orgId,context=>{if(!roles.includes(context.member?.role))fail(403,'ROLE_FORBIDDEN','Pipeline access requires management permission');return work(context);});
 const edit=(context,row)=>{if(context.member.role==='MANAGER'&&row.owner_id!==context.userId)fail(403,'ROLE_FORBIDDEN','Managers can edit only records they own');};
 const audit=(context,action,id)=>context.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)`,[context.organizationId,randomUUID(),context.userId,action,id,now()]);
 async function get(context,kind,id,locked=false){id=text(id,'Record ID',200,true);const row=(await context.query(`SELECT * FROM ${t(kind)} WHERE organization_id=? AND id=?${locked?lock:''}`,[context.organizationId,id])).rows[0];if(!row)fail(404,'NOT_FOUND',`${kind==='leads'?'Lead':kind==='deals'?'Deal':kind==='customers'?'Customer':'Project'} not found`);return normalize(row);}
 async function owner(context,id){id=text(id,'Owner ID',200,true);const member=(await context.query(`SELECT role FROM ${t('memberships')} WHERE organization_id=? AND user_id=? AND status='ACTIVE'`,[context.organizationId,id])).rows[0];if(!member||!roles.includes(member.role))fail(400,'BAD_OWNER','Owner must be a management member of this company');if(context.member.role==='MANAGER'&&id!==context.userId)fail(403,'ROLE_FORBIDDEN','Managers can assign only themselves');return id;}
 const updated=result=>{if(!(result.rowCount??result.changes))fail(409,'VERSION_CONFLICT','This record changed. Refresh and try again.');};
 const expected=(row,value)=>{version(value);if(row.version!==value)fail(409,'VERSION_CONFLICT','This record changed. Refresh and try again.');};
 async function list(context,kind,query){
  const page=pagination(query),args=[context.organizationId],where=['organization_id=?'];
  const filter=kind==='leads'?'status':'stage';if(query[filter]!==undefined){const choices=kind==='leads'?[...leadStates,'CONVERTED']:stages;if(!choices.includes(query[filter]))fail(400,'BAD_INPUT',`Invalid ${filter}`);where.push(`${kind==='leads'?'status':'stage_code'}=?`);args.push(query[filter]);}
  if(query.q!==undefined){const q=text(query.q,'Search',200);if(q){const literal=`%${q.toLowerCase().replace(/[!%_]/g,'!$&')}%`;const fields=kind==='leads'?['name','company_name','email']:['name','notes'];where.push(`(${fields.map(field=>`LOWER(${field}) LIKE ? ESCAPE '!'`).join(' OR ')})`);args.push(...fields.map(()=>literal));}}
  const clause=where.join(' AND '),total=Number((await context.query(`SELECT COUNT(*) AS total FROM ${t(kind)} WHERE ${clause}`,args)).rows[0].total);
  return {[kind]:(await context.query(`SELECT * FROM ${t(kind)} WHERE ${clause} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,[...args,page.limit,page.offset])).rows.map(normalize),pagination:{page:page.page,limit:page.limit,total,totalPages:Math.ceil(total/page.limit)}};
 }
 async function insertDeal(context,{customerId,name,ownerId,sourceLeadId=null,amountMinor=null,currency:unit='USD',expectedCloseOn=null,notes=''}){
  const id=randomUUID(),time=now();await context.query(`INSERT INTO ${t('deals')}(organization_id,id,customer_id,source_lead_id,name,owner_id,amount_minor,currency,expected_close_on,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[context.organizationId,id,customerId,sourceLeadId,name,ownerId,amountMinor,unit,expectedCloseOn,notes,time,time]);await audit(context,'deal.created',id);return get(context,'deals',id);
 }
 return {
  stages(userId,orgId){return tx(userId,orgId,async context=>({stages:(await context.query(`SELECT * FROM ${t('pipeline_stages')} WHERE organization_id=? ORDER BY position`,[orgId])).rows}));},
  leads(userId,orgId,query={}){return tx(userId,orgId,context=>list(context,'leads',query));},
  lead(userId,orgId,id){return tx(userId,orgId,context=>get(context,'leads',id));},
  createLead(userId,orgId,value){return tx(userId,orgId,async context=>{
   const body=input(value,['name','companyName','email','phone','notes','ownerId','followUpOn']),id=randomUUID(),time=now();
   const ownerId=await owner(context,body.ownerId??userId);
   await context.query(`INSERT INTO ${t('leads')}(organization_id,id,name,company_name,email,phone,notes,owner_id,follow_up_on,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,[orgId,id,text(body.name,'Lead name',200,true),text(body.companyName,'Company name',200,true),mail(body.email),text(body.phone,'Phone',50),text(body.notes,'Notes',10000),ownerId,date(body.followUpOn),time,time]);
   await audit(context,'lead.created',id);return get(context,'leads',id);
  });},
  updateLead(userId,orgId,id,value){return tx(userId,orgId,async context=>{
   const body=input(value,['version','name','companyName','email','phone','notes','ownerId','status','followUpOn']),old=await get(context,'leads',id,true);edit(context,old);expected(old,body.version);if(old.status==='CONVERTED')fail(409,'LEAD_CONVERTED','Converted leads cannot be edited');
   const state=body.status??old.status;if(!leadStates.includes(state))fail(400,'BAD_INPUT','Invalid lead status');
   const ownerId=await owner(context,has(body,'ownerId')?body.ownerId:old.owner_id);
   updated(await context.query(`UPDATE ${t('leads')} SET name=?,company_name=?,email=?,phone=?,notes=?,owner_id=?,status=?,follow_up_on=?,version=version+1,updated_at=? WHERE organization_id=? AND id=? AND version=?`,[has(body,'name')?text(body.name,'Lead name',200,true):old.name,has(body,'companyName')?text(body.companyName,'Company name',200,true):old.company_name,has(body,'email')?mail(body.email):old.email,has(body,'phone')?text(body.phone,'Phone',50):old.phone,has(body,'notes')?text(body.notes,'Notes',10000):old.notes,ownerId,state,has(body,'followUpOn')?date(body.followUpOn):old.follow_up_on,now(),orgId,id,body.version]));await audit(context,'lead.updated',id);return get(context,'leads',id);
  });},
  convertLead(userId,orgId,id,value){return tx(userId,orgId,async context=>{
   const body=input(value,['version','customerId']);version(body.version);const lead=await get(context,'leads',id,true);edit(context,lead);
   const target=has(body,'customerId')?text(body.customerId,'Customer ID',200,true):null;
   if(lead.status==='CONVERTED'){
    if(target&&target!==lead.converted_customer_id)fail(409,'CONVERSION_TARGET_MISMATCH','Lead was converted to a different customer');
    const customer=await get(context,'customers',lead.converted_customer_id);edit(context,customer);
    const contact=lead.converted_contact_id?await get(context,'contacts',lead.converted_contact_id):null;
    const deal=normalize((await context.query(`SELECT * FROM ${t('deals')} WHERE organization_id=? AND source_lead_id=?`,[orgId,id])).rows[0]);if(!deal)fail(409,'CONVERSION_INCOMPLETE','Converted deal is missing');edit(context,deal);
    return {lead,customer,contact,deal,replayed:true};
   }
   expected(lead,body.version);if(lead.status!=='QUALIFIED')fail(409,'LEAD_NOT_QUALIFIED','Qualify this lead before conversion');
   let customer;
   if(target){customer=await get(context,'customers',target,true);edit(context,customer);}else{
    const customerId=randomUUID(),time=now();await context.query(`INSERT INTO ${t('customers')}(organization_id,id,name,email,phone,notes,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,[orgId,customerId,lead.company_name,lead.email,lead.phone,lead.notes,lead.owner_id,time,time]);await audit(context,'customer.created',customerId);customer=await get(context,'customers',customerId);
   }
   let contact=lead.email?(await context.query(`SELECT * FROM ${t('contacts')} WHERE organization_id=? AND customer_id=? AND LOWER(email)=? ORDER BY created_at,id LIMIT 1`,[orgId,customer.id,lead.email.toLowerCase()])).rows[0]:null;
   if(!contact){const contactId=randomUUID();await context.query(`INSERT INTO ${t('contacts')}(organization_id,id,customer_id,name,email,phone,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,[orgId,contactId,customer.id,lead.name,lead.email,lead.phone,userId,now()]);await audit(context,'contact.created',contactId);contact=await get(context,'contacts',contactId);}
   const deal=await insertDeal(context,{customerId:customer.id,sourceLeadId:id,name:`${lead.company_name} opportunity`.slice(0,200),ownerId:lead.owner_id,notes:lead.notes});
   updated(await context.query(`UPDATE ${t('leads')} SET status='CONVERTED',converted_customer_id=?,converted_contact_id=?,version=version+1,updated_at=? WHERE organization_id=? AND id=? AND version=?`,[customer.id,contact.id,now(),orgId,id,body.version]));await audit(context,'lead.converted',id);return {lead:await get(context,'leads',id),customer,contact,deal,replayed:false};
  });},
  deals(userId,orgId,query={}){return tx(userId,orgId,context=>list(context,'deals',query));},
  deal(userId,orgId,id){return tx(userId,orgId,context=>get(context,'deals',id));},
  createDeal(userId,orgId,value){return tx(userId,orgId,async context=>{
   const body=input(value,['customerId','name','ownerId','amountMinor','currency','expectedCloseOn','notes']),customer=await get(context,'customers',body.customerId,true);edit(context,customer);
   return insertDeal(context,{customerId:customer.id,name:text(body.name,'Deal name',200,true),ownerId:await owner(context,body.ownerId??userId),amountMinor:amount(body.amountMinor),currency:currency(body.currency??'USD'),expectedCloseOn:date(body.expectedCloseOn),notes:text(body.notes,'Notes',10000)});
  });},
  updateDeal(userId,orgId,id,value){return tx(userId,orgId,async context=>{
   const body=input(value,['version','name','ownerId','stage','amountMinor','currency','expectedCloseOn','notes','lostReason']),old=await get(context,'deals',id,true);edit(context,old);expected(old,body.version);if(['WON','LOST'].includes(old.stage_code))fail(409,'DEAL_CLOSED','Closed deals cannot be edited');
   const stage=body.stage??old.stage_code;if(!stages.includes(stage))fail(400,'BAD_INPUT','Invalid deal stage');const reason=has(body,'lostReason')?text(body.lostReason,'Lost reason',2000):old.lost_reason;if(stage==='LOST'&&!reason)fail(400,'BAD_INPUT','A lost reason is required');if(stage!=='LOST'&&reason)fail(400,'BAD_INPUT','Lost reason is only valid for lost deals');
   updated(await context.query(`UPDATE ${t('deals')} SET name=?,owner_id=?,stage_code=?,amount_minor=?,currency=?,expected_close_on=?,notes=?,lost_reason=?,closed_at=?,version=version+1,updated_at=? WHERE organization_id=? AND id=? AND version=?`,[has(body,'name')?text(body.name,'Deal name',200,true):old.name,await owner(context,has(body,'ownerId')?body.ownerId:old.owner_id),stage,has(body,'amountMinor')?amount(body.amountMinor):old.amount_minor,has(body,'currency')?currency(body.currency):old.currency,has(body,'expectedCloseOn')?date(body.expectedCloseOn):old.expected_close_on,has(body,'notes')?text(body.notes,'Notes',10000):old.notes,reason,['WON','LOST'].includes(stage)?now():null,now(),orgId,id,body.version]));await audit(context,'deal.updated',id);return get(context,'deals',id);
  });},
  createProject(userId,orgId,id,value){return tx(userId,orgId,async context=>{
   const body=input(value,['version','name','managerId','deadline']);version(body.version);
   const options={...(has(body,'name')?{name:text(body.name,'Project name',200,true)}:{}),...(has(body,'managerId')?{managerId:text(body.managerId,'Manager ID',200,true)}:{}),...(has(body,'deadline')?{deadline:date(body.deadline)}:{})};
   const deal=await get(context,'deals',id,true);edit(context,deal);const customer=await get(context,'customers',deal.customer_id,true);edit(context,customer);if(deal.stage_code!=='WON')fail(409,'DEAL_NOT_WON','Only won deals can create delivery projects');
   const existing=(await context.query(`SELECT project_id FROM ${t('deal_projects')} WHERE organization_id=? AND deal_id=?`,[orgId,id])).rows[0];if(existing){const project=await get(context,'projects',existing.project_id);if(has(options,'name')&&options.name!==project.name||has(options,'managerId')&&options.managerId!==project.manager_id||has(options,'deadline')&&options.deadline!==project.deadline)fail(409,'PROJECT_OPTIONS_MISMATCH','A project already exists with different creation options');return {project,deal,replayed:true};}
   expected(deal,body.version);const managerId=await owner(context,body.managerId??userId),projectId=randomUUID(),time=now();
   await context.query(`INSERT INTO ${t('projects')}(organization_id,id,name,client_name,description,manager_id,deadline,created_at) VALUES (?,?,?,?,?,?,?,?)`,[orgId,projectId,has(body,'name')?text(body.name,'Project name',200,true):deal.name,customer.name,deal.notes,managerId,date(body.deadline),time]);
   await context.query(`INSERT INTO ${t('project_customers')}(organization_id,project_id,customer_id,linked_by,created_at) VALUES (?,?,?,?,?)`,[orgId,projectId,customer.id,userId,time]);
   await context.query(`INSERT INTO ${t('deal_projects')}(organization_id,deal_id,project_id,created_by,created_at) VALUES (?,?,?,?,?)`,[orgId,id,projectId,userId,time]);
   updated(await context.query(`UPDATE ${t('deals')} SET version=version+1,updated_at=? WHERE organization_id=? AND id=? AND version=?`,[time,orgId,id,body.version]));
   await audit(context,'project.created',projectId);await audit(context,'customer.project_linked',projectId);await audit(context,'deal.project_created',id);return {project:await get(context,'projects',projectId),deal:await get(context,'deals',id),replayed:false};
  });}
 };
}
