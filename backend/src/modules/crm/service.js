import { randomUUID } from 'node:crypto';
import { ApiError } from '../../middleware/errorHandler.js';
import { createPlatformService } from '../../platform/service.js';

const management=['OWNER','ADMIN','MANAGER'];
const statuses=['PROSPECT','ACTIVE','ARCHIVED'];
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const own=(input,key)=>Object.hasOwn(input,key);
const stamp=()=>new Date().toISOString();
function string(value,label,max,{required=false}={}) {
 if(value===undefined&&!required)return '';
 if(typeof value!=='string'||value.includes('\0')||value.trim().length>max||required&&!value.trim())fail(400,'BAD_INPUT',`${label} must be ${required?'nonempty ':''}text up to ${max} characters without NUL characters`);
 return value.trim();
}
function email(value){const result=string(value,'Email',254);if(result&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))fail(400,'BAD_INPUT','Email must be valid');return result.toLowerCase();}
function website(value){const result=string(value,'Website',2048);if(result){let url;try{url=new URL(result);}catch{fail(400,'BAD_INPUT','Website must be a valid http or https URL');}if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)fail(400,'BAD_INPUT','Website must be an http or https URL without credentials');}return result;}
function body(input,allowed){if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'BAD_INPUT','A JSON object is required');if(Object.keys(input).some(key=>!allowed.includes(key)))fail(400,'BAD_INPUT','Request contains unsupported fields');return input;}
function page(query={}){
 const integer=(key,fallback,max)=>{if(query[key]===undefined)return fallback;if(typeof query[key]!=='string'||!/^\d+$/.test(query[key]))fail(400,'BAD_INPUT',`Invalid ${key}`);const value=Number(query[key]);if(!Number.isSafeInteger(value)||value<1||value>max)fail(400,'BAD_INPUT',`Invalid ${key}`);return value;};
 const current=integer('page',1,1000000),limit=integer('limit',25,100);
 return {page:current,limit,offset:(current-1)*limit};
}

export function createCrmService(db){
 const platform=createPlatformService(db),prefix=db.kind==='postgres'?'novaworks.':'';
 const table=name=>`${prefix}platform_${name}`;
 const read=context=>{if(!management.includes(context.member?.role))fail(403,'ROLE_FORBIDDEN','CRM access requires an owner, administrator or manager');};
 const edit=(context,customer)=>{read(context);if(context.member.role==='MANAGER'&&customer.owner_id!==context.userId)fail(403,'ROLE_FORBIDDEN','Managers can edit only customers they own');};
 const transaction=(userId,organizationId,work)=>platform.transaction(userId,organizationId,async context=>{read(context);return work(context);});
 const audit=(context,action,id)=>context.query(`INSERT INTO ${table('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)`,[context.organizationId,randomUUID(),context.userId,action,id,stamp()]);
 async function customer(context,id){if(typeof id!=='string'||!id||id.length>200||id.includes('\0')||id!==id.trim())fail(400,'BAD_INPUT','Invalid customer ID');const row=(await context.query(`SELECT * FROM ${table('customers')} WHERE organization_id=? AND id=?`,[context.organizationId,id])).rows[0];if(!row)fail(404,'NOT_FOUND','Customer not found');return row;}
 async function owner(context,id){
  const membership=(await context.query(`SELECT role FROM ${table('memberships')} WHERE organization_id=? AND user_id=? AND status='ACTIVE'`,[context.organizationId,id])).rows[0];
  if(!membership||!management.includes(membership.role))fail(400,'BAD_OWNER','Customer owner must be a manager, administrator or owner in this company');
  if(context.member.role==='MANAGER'&&id!==context.userId)fail(403,'ROLE_FORBIDDEN','Managers can assign customers only to themselves');
 }
 async function listChildren(context,customerId,kind,query){
  await customer(context,customerId);const pagination=page(query);
  const args=[context.organizationId,customerId];
  const total=Number((await context.query(`SELECT COUNT(*) AS total FROM ${table(kind)} WHERE organization_id=? AND customer_id=?`,args)).rows[0].total);
  const rows=(await context.query(`SELECT * FROM ${table(kind)} WHERE organization_id=? AND customer_id=? ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,[...args,pagination.limit,pagination.offset])).rows;
  return {[kind]:rows,pagination:{page:pagination.page,limit:pagination.limit,total,totalPages:Math.ceil(total/pagination.limit)}};
 }
 return {
  list(userId,organizationId,query={}){return transaction(userId,organizationId,async context=>{
   const pagination=page(query),args=[organizationId],where=['organization_id=?'];
   if(query.status!==undefined){if(!statuses.includes(query.status))fail(400,'BAD_INPUT','Invalid customer status');where.push('status=?');args.push(query.status);}
   if(query.q!==undefined){const search=string(query.q,'Search',200);if(search){const literal=`%${search.toLowerCase().replace(/[!%_]/g,'!$&')}%`;where.push("(LOWER(name) LIKE ? ESCAPE '!' OR LOWER(email) LIKE ? ESCAPE '!' OR LOWER(phone) LIKE ? ESCAPE '!')");args.push(literal,literal,literal);}}
   const predicate=where.join(' AND ');
   const total=Number((await context.query(`SELECT COUNT(*) AS total FROM ${table('customers')} WHERE ${predicate}`,args)).rows[0].total);
   const customers=(await context.query(`SELECT * FROM ${table('customers')} WHERE ${predicate} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,[...args,pagination.limit,pagination.offset])).rows;
   return {customers,pagination:{page:pagination.page,limit:pagination.limit,total,totalPages:Math.ceil(total/pagination.limit)}};
  });},
  get(userId,organizationId,id){return transaction(userId,organizationId,context=>customer(context,id));},
  create(userId,organizationId,input){return transaction(userId,organizationId,async context=>{
   body(input,['name','email','phone','website','notes','ownerId']);const name=string(input.name,'Customer name',200,{required:true});
   const values={email:email(input.email),phone:string(input.phone,'Phone',50),website:website(input.website),notes:string(input.notes,'Notes',10000)};
   const ownerId=input.ownerId===undefined?userId:string(input.ownerId,'Owner',200,{required:true});await owner(context,ownerId);
   const id=randomUUID(),time=stamp();
   await context.query(`INSERT INTO ${table('customers')}(organization_id,id,name,email,phone,website,notes,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,[organizationId,id,name,values.email,values.phone,values.website,values.notes,ownerId,time,time]);
   await audit(context,'customer.created',id);return customer(context,id);
  });},
  update(userId,organizationId,id,input){return transaction(userId,organizationId,async context=>{
   body(input,['version','name','email','phone','website','notes','status','ownerId']);const old=await customer(context,id);edit(context,old);
   if(!Number.isSafeInteger(input.version)||input.version<1)fail(400,'BAD_INPUT','Current integer version is required');
   if(input.version!==old.version)fail(409,'VERSION_CONFLICT','This customer changed. Refresh and apply your changes again.');
   const next={name:own(input,'name')?string(input.name,'Customer name',200,{required:true}):old.name,email:own(input,'email')?email(input.email):old.email,phone:own(input,'phone')?string(input.phone,'Phone',50):old.phone,website:own(input,'website')?website(input.website):old.website,notes:own(input,'notes')?string(input.notes,'Notes',10000):old.notes,status:own(input,'status')?input.status:old.status,owner_id:own(input,'ownerId')?string(input.ownerId,'Owner',200,{required:true}):old.owner_id};
   if(!statuses.includes(next.status))fail(400,'BAD_INPUT','Invalid customer status');await owner(context,next.owner_id);
   const updated=await context.query(`UPDATE ${table('customers')} SET name=?,email=?,phone=?,website=?,notes=?,status=?,owner_id=?,version=version+1,updated_at=? WHERE organization_id=? AND id=? AND version=?`,[next.name,next.email,next.phone,next.website,next.notes,next.status,next.owner_id,stamp(),organizationId,id,input.version]);
   if(!(updated.rowCount??updated.changes))fail(409,'VERSION_CONFLICT','This customer changed. Refresh and apply your changes again.');
   await audit(context,'customer.updated',id);return customer(context,id);
  });},
  contacts(userId,organizationId,id,query={}){return transaction(userId,organizationId,context=>listChildren(context,id,'contacts',query));},
  addContact(userId,organizationId,customerId,input){return transaction(userId,organizationId,async context=>{
   const row=await customer(context,customerId);edit(context,row);body(input,['name','email','phone','jobTitle']);
   const name=string(input.name,'Contact name',200,{required:true}),mail=email(input.email),phone=string(input.phone,'Phone',50),job=string(input.jobTitle,'Job title',200),id=randomUUID();
   await context.query(`INSERT INTO ${table('contacts')}(organization_id,id,customer_id,name,email,phone,job_title,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,[organizationId,id,customerId,name,mail,phone,job,userId,stamp()]);
   await audit(context,'contact.created',id);return (await context.query(`SELECT * FROM ${table('contacts')} WHERE organization_id=? AND id=?`,[organizationId,id])).rows[0];
  });},
  projects(userId,organizationId,id,query={}){return transaction(userId,organizationId,async context=>{
   await customer(context,id);const pagination=page(query);
   const from=`${table('projects')} p JOIN ${table('project_customers')} l ON l.organization_id=p.organization_id AND l.project_id=p.id`;
   const args=[organizationId,id];
   const total=Number((await context.query(`SELECT COUNT(*) AS total FROM ${from} WHERE l.organization_id=? AND l.customer_id=?`,args)).rows[0].total);
   const projects=(await context.query(`SELECT p.* FROM ${from} WHERE l.organization_id=? AND l.customer_id=? ORDER BY p.created_at DESC,p.id LIMIT ? OFFSET ?`,[...args,pagination.limit,pagination.offset])).rows;
   return {projects,pagination:{page:pagination.page,limit:pagination.limit,total,totalPages:Math.ceil(total/pagination.limit)}};
  });},
  linkProject(userId,organizationId,customerId,input){return transaction(userId,organizationId,async context=>{
   const target=await customer(context,customerId);edit(context,target);body(input,['projectId']);
   const projectId=string(input.projectId,'Project ID',200,{required:true});
   const project=(await context.query(`SELECT * FROM ${table('projects')} WHERE organization_id=? AND id=?`,[organizationId,projectId])).rows[0];
   if(!project)fail(404,'NOT_FOUND','Project not found');
   if(context.member.role==='MANAGER'&&project.manager_id!==userId)fail(403,'ROLE_FORBIDDEN','Managers can link only projects they manage');
   // Unique organization/project key makes concurrent linking safe on both engines.
   const inserted=await context.query(`INSERT INTO ${table('project_customers')}(organization_id,project_id,customer_id,linked_by,created_at) VALUES (?,?,?,?,?) ON CONFLICT(organization_id,project_id) DO NOTHING`,[organizationId,projectId,customerId,userId,stamp()]);
   const link=(await context.query(`SELECT * FROM ${table('project_customers')} WHERE organization_id=? AND project_id=?`,[organizationId,projectId])).rows[0];
   if(link.customer_id!==customerId)fail(409,'PROJECT_ALREADY_LINKED','Project already belongs to another customer');
   if(inserted.rowCount??inserted.changes)await audit(context,'customer.project_linked',projectId);return link;
  });},
  activities(userId,organizationId,id,query={}){return transaction(userId,organizationId,context=>listChildren(context,id,'activities',query));},
  addActivity(userId,organizationId,customerId,input){return transaction(userId,organizationId,async context=>{
   const row=await customer(context,customerId);edit(context,row);body(input,['type','body']);
   if(!['NOTE','CALL','MEETING'].includes(input.type))fail(400,'BAD_INPUT','Activity type must be NOTE, CALL or MEETING');
   const content=string(input.body,'Activity body',10000,{required:true}),id=randomUUID();
   await context.query(`INSERT INTO ${table('activities')}(organization_id,id,customer_id,type,body,created_by,created_at) VALUES (?,?,?,?,?,?,?)`,[organizationId,id,customerId,input.type,content,userId,stamp()]);
   await audit(context,'activity.created',id);return (await context.query(`SELECT * FROM ${table('activities')} WHERE organization_id=? AND id=?`,[organizationId,id])).rows[0];
  });}
 };
}
