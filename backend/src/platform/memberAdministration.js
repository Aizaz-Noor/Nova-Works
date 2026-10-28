import {randomUUID} from 'node:crypto';
import {ApiError} from '../middleware/errorHandler.js';
import {createPlatformService} from './service.js';

const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const manageable=['ADMIN','MANAGER','MEMBER'];
const permission=c=>{if(!['OWNER','ADMIN'].includes(c.member.role))fail(403,'ROLE_FORBIDDEN','Company administrator access required');};
export function createMemberAdministration(db){
 const platform=createPlatformService(db),pg=db.kind==='postgres',prefix=pg?'novaworks.':'',members=prefix+'platform_memberships';
 return {
  list(userId,organizationId,input={}){return platform.transaction(userId,organizationId,async c=>{
   permission(c);
   if(Object.keys(input).some(key=>!['page','limit'].includes(key)))fail(400,'BAD_INPUT','Unsupported member filter');
   const integer=(key,fallback,max)=>{const value=input[key];if(value===undefined)return fallback;if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>max)fail(400,'BAD_INPUT',`Invalid ${key}`);return Number(value);};
   const page=integer('page',1,1000000),limit=integer('limit',20,100);
   const total=Number((await c.query(`SELECT COUNT(*) AS n FROM ${members} WHERE organization_id=?`,[organizationId])).rows[0].n);
   const rows=(await c.query(`SELECT m.user_id,m.role,m.status,m.version,u.name,u.email FROM ${members} m JOIN ${prefix}users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name,m.user_id LIMIT ? OFFSET ?`,[organizationId,limit,(page-1)*limit])).rows;
   return {members:rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};
  });},
  transition(userId,organizationId,targetId,input){
   if(typeof targetId!=='string'||!targetId||targetId.length>200||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['version','role','status'].includes(key))||!Number.isSafeInteger(input.version)||input.version<1||!manageable.includes(input.role)||!['ACTIVE','SUSPENDED'].includes(input.status))fail(400,'BAD_INPUT','A saved version, company role and access status are required');
   return platform.transaction(userId,organizationId,async c=>{
    permission(c);
    const target=(await c.query(`SELECT * FROM ${members} WHERE organization_id=? AND user_id=?`,[organizationId,targetId])).rows[0];
    if(!target)fail(404,'NOT_FOUND','Company member not found');
    if(targetId===userId||target.role==='OWNER'||c.member.role==='ADMIN'&&(target.role==='ADMIN'||input.role==='ADMIN'))fail(403,'ROLE_FORBIDDEN','You cannot change this company member');
    if(pg){
     try{
      const result=await c.query('SELECT * FROM novaworks.transition_company_member(?,?,?,?,?,?)',[targetId,input.version,input.role,input.status,randomUUID(),new Date().toISOString()]);
      return {member:result.rows[0]};
     }catch(error){
      if(error.code==='P0001'){
       if(error.message==='MEMBER_VERSION_CONFLICT')fail(409,'VERSION_CONFLICT','This member changed. Reload and compare the saved version before retrying.');
       if(error.message==='MEMBER_NOT_FOUND')fail(404,'NOT_FOUND','Company member not found');
       if(error.message==='MEMBER_FORBIDDEN')fail(403,'ROLE_FORBIDDEN','You cannot change this company member');
       if(error.message==='MEMBER_INVALID_TRANSITION')fail(400,'BAD_INPUT','Invalid company member transition');
      }
      throw error;
     }
    }
    if(target.version!==input.version)fail(409,'VERSION_CONFLICT','This member changed. Reload and compare the saved version before retrying.');
    if(target.role===input.role&&target.status===input.status)return {member:target};
    await c.query(`UPDATE ${members} SET role=?,status=?,version=version+1,updated_at=? WHERE organization_id=? AND user_id=? AND version=?`,[input.role,input.status,new Date().toISOString(),organizationId,targetId,input.version]);
    await c.query(`INSERT INTO ${prefix}platform_audit(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[organizationId,randomUUID(),userId,`MEMBER_TRANSITION:${input.role}:${input.status}`,targetId,new Date().toISOString()]);
    return {member:(await c.query(`SELECT * FROM ${members} WHERE organization_id=? AND user_id=?`,[organizationId,targetId])).rows[0]};
   },{memberMaintenance:true});
  }
 };
}
