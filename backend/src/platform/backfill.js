import { createPlatformService } from './service.js';
import { seedPipelineStages } from '../modules/pipeline/schema.js';
import { demoUsers } from '../db/seed.js';

export const DEMO_ORGANIZATION_ID = 'novaworks-legacy-demo';

// Explicit administrative migration only. Snapshot legacy data into an identified
// demo tenant, preserving all legacy tables and IDs; never mixes it with customers.
// Re-running inserts missing rows without overwriting edits in the tenant snapshot.
export async function backfillDemoOrganization(db) {
 const pg=db.kind==='postgres'; const prefix=pg?'novaworks.':'';
 const service=createPlatformService(db);
 const admins=pg?(await db.query(`SELECT id FROM ${prefix}users WHERE id='ADMIN' AND email='admin@novaworks.example' AND role='ADMIN'`)).rows:db.prepare("SELECT id FROM users WHERE id='ADMIN' AND email='admin@novaworks.example' AND role='ADMIN'").all();
 if(!admins.length) return {skipped:true,reason:'No legacy demo administrator exists'};
 const owner=admins[0].id;
 return service.transaction(owner,DEMO_ORGANIZATION_ID,async({query})=>{
  const stamp=new Date().toISOString();
  await query(`INSERT INTO ${prefix}platform_organizations(id,name,created_by,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING`,[DEMO_ORGANIZATION_ID,'NovaWorks Demo',owner,stamp]);
  await seedPipelineStages({query,organizationId:DEMO_ORGANIZATION_ID},prefix);
  // Only the ten fixed fixture accounts are demo identities. A later registered user
  // must never acquire legacy access simply because their global role is AGENT.
  const candidates=(await query(`SELECT id,email,role FROM ${prefix}users WHERE email LIKE ?`,['%@novaworks.example'])).rows;
  const users=candidates.filter(user=>demoUsers.some(([id,,email,role])=>user.id===id&&user.email===`${email}@novaworks.example`&&user.role===role));
  for(const user of users) await query(`INSERT INTO ${prefix}platform_memberships(organization_id,user_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(organization_id,user_id) DO NOTHING`,[DEMO_ORGANIZATION_ID,user.id,user.id===owner?'OWNER':user.role==='ADMIN'?'ADMIN':user.role==='MANAGER'?'MANAGER':'MEMBER',stamp]);
  // PostgreSQL DATE values must remain calendar dates. pg's Date conversion uses
  // local midnight, whose UTC representation can be the preceding calendar day.
  const projects=(await query(`SELECT *${pg?',deadline::text AS deadline':''} FROM ${prefix}projects`)).rows;
  let projectCount=0,taskCount=0;
  for(const project of projects){
   if(!users.some(user=>user.id===project.manager_id))throw new Error('Demo backfill manager is not a demo member; no rows migrated');
   await query(`INSERT INTO ${prefix}platform_projects(organization_id,id,name,client_name,description,manager_id,deadline,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,id) DO NOTHING`,[DEMO_ORGANIZATION_ID,project.id,project.name,project.client_name,project.description,project.manager_id,project.deadline instanceof Date?project.deadline.toISOString().slice(0,10):project.deadline,project.created_at instanceof Date?project.created_at.toISOString():project.created_at||stamp]);projectCount++;
  }
  const tasks=(await query(`SELECT *${pg?',deadline::text AS deadline':''} FROM ${prefix}tasks`)).rows;
  for(const task of tasks){
   if(!users.some(user=>user.id===task.assignee_id))throw new Error('Demo backfill assignee is not a demo member; no rows migrated');
   await query(`INSERT INTO ${prefix}platform_tasks(organization_id,id,project_id,title,description,assignee_id,deadline,estimated_hours,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,id) DO NOTHING`,[DEMO_ORGANIZATION_ID,task.id,task.project_id,task.title,task.description,task.assignee_id,task.deadline instanceof Date?task.deadline.toISOString().slice(0,10):task.deadline,task.estimated_hours,task.created_at instanceof Date?task.created_at.toISOString():task.created_at||stamp]);taskCount++;
  }
  return {organizationId:DEMO_ORGANIZATION_ID,projectCount,taskCount};
 },{bootstrap:true});
}

export function requireLegacyDemo(db) {
 return async(req,res,next)=>{
  try{
   // listOrganizations uses app.user_id before tenant selection; no caller-supplied
   // global role can grant access to the intentionally separate legacy demo.
   const organizations=await createPlatformService(db).listOrganizations(req.user?.id);
   if(!organizations.some(org=>org.id===DEMO_ORGANIZATION_ID))return res.status(403).json({success:false,error:{code:'DEMO_ONLY',message:'This legacy endpoint is restricted to demo accounts'}});
   next();
  }catch(error){next(error);}
 };
}
