import {billingConfiguration,guardCompanyMutation,initializeCompanyTrial} from './billing/policy.js';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { ApiError } from '../middleware/errorHandler.js';
import { hashPassword } from '../services/passwords.js';
import { seedPipelineStages } from '../modules/pipeline/schema.js';
import { validDate } from '../validators/aiOutput.js';

const roles = ['ADMIN','MANAGER','MEMBER'];
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
const text = (value, label, max = 200) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : fail(400,'BAD_INPUT',`${label} is required (maximum ${max} characters)`);
const digest = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const queues = new WeakMap();

export function createPlatformService(db) {
 const pg = db.kind === 'postgres';
 const table = name => `${pg ? 'novaworks.' : ''}platform_${name}`;
 const users = pg ? 'novaworks.users' : 'users';
 async function transaction(userId, organizationId, work, { bootstrap = false, snapshot = false, billingMaintenance = false, memberMaintenance = false, invitationHash = '' } = {}) {
  if (!userId) fail(401,'UNAUTHENTICATED','Login required');
  const run = async connection => {
   if (pg && snapshot) await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
   const uncheckedQuery = async (sql, values = []) => {
    if (pg) { let i=0; return connection.query(sql.replaceAll('?', () => `$${++i}`), values); }
    const statement = db.prepare(sql);
    return /^\s*(SELECT|WITH)/i.test(sql) ? { rows: statement.all(...values) } : { rows: [], ...statement.run(...values) };
   };
   let gateReady=false,billingGuardContext;
   const query=async(sql,values=[])=>{if(gateReady&&organizationId)await guardCompanyMutation(db,billingGuardContext,sql,values);return uncheckedQuery(sql,values);};
   if (pg) await connection.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true),set_config('app.invitation_hash',$3,true)", [userId, '', invitationHash]);
   let member;
   if (organizationId && !bootstrap) {
    if(pg)await uncheckedQuery('SELECT pg_advisory_xact_lock_shared(hashtextextended(?,0))',[`member:${organizationId}:${userId}`]);
    member = (await query(`SELECT * FROM ${table('memberships')} WHERE organization_id=? AND user_id=?`, [organizationId,userId])).rows[0];
    if (!member) fail(403,'TENANT_FORBIDDEN','You are not a member of this organization');
    if(member.status!=='ACTIVE')fail(403,'MEMBERSHIP_SUSPENDED','Your access to this company is suspended');
   }
   if (pg && organizationId) await connection.query("SELECT set_config('app.organization_id',$1,true)", [organizationId]);
   if(pg&&organizationId&&!snapshot&&!memberMaintenance&&billingConfiguration(db).enabled)await uncheckedQuery('SELECT pg_advisory_xact_lock(hashtext(?))',[`billing:${organizationId}`]);
   billingGuardContext={uncheckedQuery,organizationId,userId,member,billingMaintenance,memberMaintenance};
   gateReady=!bootstrap;
   return work({ query, organizationId, userId, member });
  };
  if (pg) return db.transaction(run);
  // A single DatabaseSync connection cannot have overlapping async transactions.
  const previous = queues.get(db) || Promise.resolve(); let release; queues.set(db,new Promise(resolve => { release = resolve; }));
  await previous;
  db.exec('BEGIN IMMEDIATE');
  try { const result = await run(db); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { release(); }
 }
 const admin = context => { if (!['OWNER','ADMIN'].includes(context.member?.role)) fail(403,'ROLE_FORBIDDEN','Organization administrator access required'); };
 const audit = (context, action, entityId) => context.query(`INSERT INTO ${table('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)`, [context.organizationId,randomUUID(),context.userId,action,entityId,now()]);
 const service = {
  transaction,
  async register(input) {
   const name = text(input?.name,'Name',100);
   const email = text(input?.email,'Email',254).toLowerCase();
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'BAD_INPUT','A valid email is required');
   if(email.endsWith('@novaworks.example'))fail(400,'RESERVED_EMAIL','The demo email domain is reserved');
   if (typeof input?.password !== 'string' || input.password.length < 12 || input.password.length > 128) fail(400,'BAD_INPUT','Password must contain 12 to 128 characters');
   const id = randomUUID(); const passwordHash = hashPassword(input.password);
   return transaction(id,null,async context => {
    if ((await context.query(`SELECT id FROM ${users} WHERE email=?`, [email])).rows.length) fail(409,'ACCOUNT_EXISTS','An account already uses this email; sign in instead');
    await context.query(`INSERT INTO ${users}(id,name,email,password_hash,role,specialization,skills) VALUES (?,?,?,?,?,?,?)`, [id,name,email,passwordHash,'AGENT','Organization member','[]']);
    return {id,name,email,role:'AGENT',specialization:'Organization member'};
   });
  },
  listOrganizations(userId) { return transaction(userId,null,async ({query}) => (await query(`SELECT o.id,o.name,m.role FROM ${table('organizations')} o JOIN ${table('memberships')} m ON m.organization_id=o.id WHERE m.user_id=? AND m.status='ACTIVE' ORDER BY o.name`,[userId])).rows); },
  createOrganization(userId,input) {
   const name = text(input?.name,'Organization name',120); const id = randomUUID();
   return transaction(userId,id,async context => {
    await context.query(`INSERT INTO ${table('organizations')}(id,name,created_by,created_at) VALUES (?,?,?,?)`,[id,name,userId,now()]);
    await context.query(`INSERT INTO ${table('memberships')}(organization_id,user_id,role,created_at) VALUES (?,?,?,?)`,[id,userId,'OWNER',now()]);
    await seedPipelineStages(context,pg?'novaworks.':'');
    await initializeCompanyTrial(db,context);
    await audit(context,'organization.created',id); return {id,name,role:'OWNER'};
   },{bootstrap:true});
  },
  selectOrganization(userId,id) { return transaction(userId,text(id,'Organization ID'),async context => ({organizationId:context.organizationId,role:context.member.role})); },
  listMembers(userId,id) { return transaction(userId,id,async context => (await context.query(`SELECT m.user_id,m.role,m.status,m.version,u.name,u.email FROM ${table('memberships')} m JOIN ${users} u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.name`,[id])).rows); },
  invite(userId,id,input) {
   const email = text(input?.email,'Email',254).toLowerCase();
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.includes(input?.role)) fail(400,'BAD_INPUT','Valid email and ADMIN, MANAGER or MEMBER role required');
   const token = randomBytes(32).toString('base64url'); const invitationId = randomUUID();
   return transaction(userId,id,async context => {
    admin(context);
    if (input.role === 'ADMIN' && context.member.role !== 'OWNER') fail(403,'ROLE_FORBIDDEN','Only an owner can invite administrators');
    const expiresAt = new Date(Date.now()+48*3600_000).toISOString();
    await context.query(`INSERT INTO ${table('invitations')}(organization_id,id,email,role,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?)`,[id,invitationId,email,input.role,digest(token),expiresAt,now()]);
    await audit(context,'invitation.created',invitationId);
    return {id:invitationId,token,expiresAt,email,role:input.role};
   });
  },
  acceptInvitation(userId,organizationId,token) {
   if (typeof token !== 'string' || token.length !== 43) fail(400,'INVALID_INVITATION','Invalid invitation');
   // Possession of a high-entropy invitation plus the signed-in account email is the
   // proof. No request body may substitute another user identity or email address.
   return transaction(userId,text(organizationId,'Organization ID'),async context => {
    const invitation = (await context.query(`SELECT * FROM ${table('invitations')} WHERE organization_id=? AND token_hash=?${pg?' FOR UPDATE':''}`,[organizationId,digest(token)])).rows[0];
    const user = (await context.query(`SELECT email FROM ${users} WHERE id=?`,[userId])).rows[0];
    if (!invitation || invitation.accepted_at || invitation.expires_at <= now() || invitation.email !== user?.email?.toLowerCase()) fail(400,'INVALID_INVITATION','Invitation is invalid, expired, used, or belongs to another account');
    const old = (await context.query(`SELECT role FROM ${table('memberships')} WHERE organization_id=? AND user_id=?`,[organizationId,userId])).rows[0];
    if (old) fail(409,'ALREADY_MEMBER','You already belong to this organization');
    await guardCompanyMutation(db,{...context,uncheckedQuery:context.query},'INSERT INTO platform_memberships',[]);
    await context.query(`INSERT INTO ${table('memberships')}(organization_id,user_id,role,created_at) VALUES (?,?,?,?)`,[organizationId,userId,invitation.role,now()]);
    await context.query(`UPDATE ${table('invitations')} SET accepted_at=? WHERE organization_id=? AND id=?`,[now(),organizationId,invitation.id]);
    await audit(context,'invitation.accepted',invitation.id); return {organizationId,role:invitation.role};
   },{bootstrap:true,invitationHash:digest(token)});
  },
  listProjects(userId,id) { return transaction(userId,id,async ({query}) => (await query(`SELECT * FROM ${table('projects')} WHERE organization_id=? ORDER BY created_at,id`,[id])).rows); },
  createProject(userId,id,input) {
   const name = text(input?.name,'Project name'); const description = typeof input?.description === 'string' ? input.description.slice(0,5000) : '';
   return transaction(userId,id,async context => {
    if (!['OWNER','ADMIN','MANAGER'].includes(context.member.role)) fail(403,'ROLE_FORBIDDEN','Project manager access required');
    const managerId = input?.managerId || userId;
    const manager = (await context.query(`SELECT role FROM ${table('memberships')} WHERE organization_id=? AND user_id=? AND status='ACTIVE'`,[id,managerId])).rows[0];
    if (!manager || !['OWNER','ADMIN','MANAGER'].includes(manager.role)) fail(400,'BAD_MANAGER','Manager must belong to this organization and have management access');
    const projectId = randomUUID();
    const clientName=input?.clientName===undefined?'':text(input.clientName,'Client name');
    const deadline=input?.deadline??null;
    if(deadline!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline))||new Date(deadline).toISOString().slice(0,10)!==deadline))fail(400,'BAD_INPUT','Deadline must be a real YYYY-MM-DD date');
    await context.query(`INSERT INTO ${table('projects')}(organization_id,id,name,client_name,description,manager_id,deadline,created_at) VALUES (?,?,?,?,?,?,?,?)`,[id,projectId,name,clientName,description,managerId,deadline,now()]);
    await audit(context,'project.created',projectId);
    return (await context.query(`SELECT * FROM ${table('projects')} WHERE organization_id=? AND id=?`,[id,projectId])).rows[0];
   });
  },
  updateProject(userId,id,projectId,input) { return transaction(userId,id,async context => {
   if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Object.keys(input).some(key=>!['name','status','deadline','version'].includes(key)))fail(400,'BAD_INPUT','Unsupported project update');
   const project = (await context.query(`SELECT * FROM ${table('projects')} WHERE organization_id=? AND id=?${pg?' FOR UPDATE':''}`,[id,projectId])).rows[0];
   if (!project) fail(404,'NOT_FOUND','Project not found');
   if (!['OWNER','ADMIN'].includes(context.member.role) && !(context.member.role === 'MANAGER' && project.manager_id === userId)) fail(403,'ROLE_FORBIDDEN','You cannot modify this project');
   const expectedVersion=input?.version;
   if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail(400,'BAD_INPUT','A positive project version is required');
   if(expectedVersion!==project.version||project.version>=2147483647)fail(409,'VERSION_CONFLICT','Project changed; refresh it before saving');
   const name = input?.name === undefined ? project.name : text(input.name,'Project name');
   const status = input?.status ?? project.status;
   if (!['PLANNED','ACTIVE','DONE','ARCHIVED'].includes(status)) fail(400,'BAD_INPUT','Invalid project status');
   const deadline=input.deadline===undefined?project.deadline:input.deadline;
   if(input.deadline!==undefined&&deadline!==null&&!validDate(deadline))fail(400,'BAD_INPUT','Deadline must be a real YYYY-MM-DD date');
   if(input.deadline!==undefined&&deadline!==null){
    const latest=(await context.query(`SELECT MAX(deadline) AS latest FROM ${table('tasks')} WHERE organization_id=? AND project_id=?`,[id,projectId])).rows[0]?.latest;
    if(latest&&latest>deadline)fail(400,'BAD_DEADLINE',`Choose a project deadline on or after the latest task date (${latest}), or correct task dates first`);
   }
   const changed=await context.query(`UPDATE ${table('projects')} SET name=?,status=?,deadline=?,version=version+1 WHERE organization_id=? AND id=? AND version=?`,[name,status,deadline,id,projectId,expectedVersion]);
   if(changed.changes!==undefined?changed.changes!==1:changed.rowCount!==1)fail(409,'VERSION_CONFLICT','Project changed; refresh it before saving');
   await audit(context,'project.updated',projectId); return {...project,name,status,deadline,version:expectedVersion+1};
  }); },
  // Read/export references always include selected tenant and membership validation.
  getReference(userId,id,kind,referenceId) {
   if (!['drafts','files','projects'].includes(kind)) fail(400,'BAD_INPUT','Unknown reference type');
   return transaction(userId,id,async ({query}) => {
    const row=(await query(`SELECT * FROM ${table(kind)} WHERE organization_id=? AND id=?`,[id,referenceId])).rows[0];
    if (!row) fail(404,'NOT_FOUND','Record not found'); return row;
   });
  },
  exportProjects(userId,id) { return transaction(userId,id,async context => { admin(context); await audit(context,'projects.exported',id); return (await context.query(`SELECT * FROM ${table('projects')} WHERE organization_id=?`,[id])).rows; }); }
 };
 return service;
}
