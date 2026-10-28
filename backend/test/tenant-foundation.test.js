import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { migratePlatform,migrations } from '../src/platform/migrations.js';
import {createMemberAdministration} from '../src/platform/memberAdministration.js';
import { createPlatformService } from '../src/platform/service.js';
import { backfillDemoOrganization } from '../src/platform/backfill.js';

test('two companies: onboarding, invitations, project isolation, reference/export denial, restart persistence',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'novaworks-tenants-'));const path=join(folder,'tenant.sqlite');
 let db=openDatabase(path);
 try{
  await migratePlatform(db);await migratePlatform(db);
  let service=createPlatformService(db);
  const register=(name,email)=>service.register({name,email,password:'a-strong-password-123'});
  const [a,b,c,d,e]=await Promise.all([register('Alpha Owner','a@alpha.test'),register('Alpha Member','b@alpha.test'),register('Beta Owner','c@beta.test'),register('Beta Manager','d@beta.test'),register('Beta Member','e@beta.test')]);
  const alpha=await service.createOrganization(a.id,{name:'Alpha Digital'});
  const beta=await service.createOrganization(c.id,{name:'Beta Consulting'});
  async function invite(owner,org,member,role){const invitation=await service.invite(owner.id,org.id,{email:member.email,role});await service.acceptInvitation(member.id,org.id,invitation.token);await assert.rejects(service.acceptInvitation(member.id,org.id,invitation.token),error=>error.code==='INVALID_INVITATION');return invitation;}
  await invite(a,alpha,b,'MEMBER');await invite(c,beta,d,'MANAGER');await invite(c,beta,e,'MEMBER');
  const alphaProjects=[];for(let i=0;i<3;i++)alphaProjects.push(await service.createProject(a.id,alpha.id,{name:`Alpha ${i}`}));
  const betaProjects=[];for(let i=0;i<2;i++)betaProjects.push(await service.createProject(c.id,beta.id,{name:`Beta ${i}`,managerId:d.id}));
  assert.equal((await service.listMembers(a.id,alpha.id)).length,2);
  assert.equal((await service.listMembers(c.id,beta.id)).length,3);
  assert.equal((await service.listProjects(b.id,alpha.id)).length,3);
  assert.equal((await service.listProjects(e.id,beta.id)).length,2);
  await assert.rejects(service.selectOrganization(a.id,beta.id),error=>error.code==='TENANT_FORBIDDEN');
  await assert.rejects(service.listProjects(a.id,beta.id),error=>error.code==='TENANT_FORBIDDEN');
  await assert.rejects(service.updateProject(a.id,alpha.id,betaProjects[0].id,{name:'Stolen'}),error=>error.code==='NOT_FOUND');
  await assert.rejects(service.createProject(a.id,alpha.id,{name:'Bad manager',managerId:d.id}),error=>error.code==='BAD_MANAGER');
  await assert.rejects(service.createProject(b.id,alpha.id,{name:'Not allowed'}),error=>error.code==='ROLE_FORBIDDEN');
  await service.updateProject(d.id,beta.id,betaProjects[0].id,{status:'ACTIVE',version:betaProjects[0].version});
  await service.transaction(c.id,beta.id,async({query})=>{
   await query('INSERT INTO platform_drafts(organization_id,id,payload,created_by,created_at) VALUES (?,?,?,?,?)',[beta.id,'secret-draft','secret',c.id,new Date().toISOString()]);
   await query('INSERT INTO platform_files(organization_id,id,name,storage_key,created_by,created_at) VALUES (?,?,?,?,?,?)',[beta.id,'secret-file','secret.pdf','private/secret',c.id,new Date().toISOString()]);
  });
  for(const [kind,id] of [['drafts','secret-draft'],['files','secret-file'],['projects',betaProjects[0].id]])await assert.rejects(service.getReference(a.id,alpha.id,kind,id),error=>error.code==='NOT_FOUND');
  assert.equal((await service.exportProjects(a.id,alpha.id)).length,3);
  await assert.rejects(service.exportProjects(a.id,beta.id),error=>error.code==='TENANT_FORBIDDEN');
  // Database FK rejects a cross-tenant reference even if application validation fails.
  assert.throws(()=>db.prepare('INSERT INTO platform_tasks(organization_id,id,project_id,title,assignee_id,created_at) VALUES (?,?,?,?,?,?)').run(alpha.id,'bad-task',betaProjects[0].id,'Bad',b.id,new Date().toISOString()),/FOREIGN KEY/);
  const wrong=await service.invite(a.id,alpha.id,{email:'not-you@alpha.test',role:'MEMBER'});
  await assert.rejects(service.acceptInvitation(e.id,alpha.id,wrong.token),error=>error.code==='INVALID_INVITATION');
  const expired=await service.invite(a.id,alpha.id,{email:e.email,role:'MEMBER'});
  db.prepare('UPDATE platform_invitations SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',expired.id);
  await assert.rejects(service.acceptInvitation(e.id,alpha.id,expired.token),error=>error.code==='INVALID_INVITATION');
  // Revoking membership invalidates a previously selected session on every call.
  await service.selectOrganization(b.id,alpha.id);
  await createMemberAdministration(db).transition(a.id,alpha.id,b.id,{version:1,role:'MEMBER',status:'SUSPENDED'});
  await assert.rejects(service.listProjects(b.id,alpha.id),error=>error.code==='MEMBERSHIP_SUSPENDED');
  db.close();db=openDatabase(path);await migratePlatform(db);service=createPlatformService(db);
  assert.equal((await service.listProjects(a.id,alpha.id)).length,3);
  assert.equal((await service.listProjects(c.id,beta.id)).length,2);
  assert.equal((await service.listOrganizations(a.id)).length,1);
  assert.equal((await service.getReference(c.id,beta.id,'projects',betaProjects[0].id)).status,'ACTIVE');
  assert.ok(db.prepare('SELECT COUNT(*) AS count FROM platform_audit').get().count>=13);
 }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});

test('versioned migrations reject checksum drift and roll back',async()=>{
 const db=openDatabase(':memory:');try{await migratePlatform(db);db.prepare('UPDATE platform_migrations SET checksum=?').run('changed');await assert.rejects(migratePlatform(db),/checksum mismatch/);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM platform_migrations').get().n,migrations.length);}finally{db.close();}
});

test('demo migration is explicit, additive, idempotent and excludes new commercial users',async()=>{
 const db=openDatabase(':memory:');try{
  await migratePlatform(db);
  db.prepare("INSERT INTO users VALUES ('ADMIN','Demo','admin@novaworks.example','not-a-real-hash','ADMIN','Demo','[]')").run();
  db.prepare("INSERT INTO users VALUES ('PM01','Manager','ayesha@novaworks.example','not-a-real-hash','MANAGER','Demo','[]')").run();
  db.prepare("INSERT INTO users VALUES ('DEV01','Agent','ali@novaworks.example','not-a-real-hash','AGENT','Demo','[]')").run();
  db.prepare("INSERT INTO projects(id,name,client_name,manager_id,deadline) VALUES ('legacy','Legacy','Client','PM01','2026-12-01')").run();
  db.prepare("INSERT INTO tasks(id,project_id,title,assignee_id,deadline,estimated_hours) VALUES ('legacy-task','legacy','Task','DEV01','2026-11-01',2)").run();
  const service=createPlatformService(db);const commercial=await service.register({name:'Commercial',email:'real@business.test',password:'a-strong-password-123'});
  assert.equal((await backfillDemoOrganization(db)).projectCount,1);await backfillDemoOrganization(db);
  assert.equal(db.prepare('SELECT version FROM platform_projects WHERE id=?').get('legacy').version,1);
  assert.equal(db.prepare('SELECT version FROM platform_tasks WHERE id=?').get('legacy-task').version,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM platform_projects').get().n,1);
  assert.equal(db.prepare('SELECT client_name,deadline FROM platform_projects').get().client_name,'Client');
  assert.equal(db.prepare('SELECT client_name,deadline FROM platform_projects').get().deadline,'2026-12-01');
  assert.equal(db.prepare('SELECT estimated_hours,deadline FROM platform_tasks').get().estimated_hours,2);
  assert.equal(db.prepare('SELECT estimated_hours,deadline FROM platform_tasks').get().deadline,'2026-11-01');
  assert.equal((await service.listOrganizations(commercial.id)).length,0);
 }finally{db.close();}
});

test('independent service instances serialize SQLite transactions and reserve demo identities',async()=>{
 const db=openDatabase(':memory:');try{
  await migratePlatform(db);const one=createPlatformService(db),two=createPlatformService(db);
  const [a,b]=await Promise.all([one.register({name:'A',email:'a@test.dev',password:'a-strong-password-123'}),two.register({name:'B',email:'b@test.dev',password:'a-strong-password-123'})]);
  const orgs=await Promise.all([one.createOrganization(a.id,{name:'A'}),two.createOrganization(b.id,{name:'B'})]);
  assert.equal(orgs.length,2);
  await assert.rejects(one.register({name:'Fake demo',email:'fake@novaworks.example',password:'a-strong-password-123'}),error=>error.code==='RESERVED_EMAIL');
 }finally{db.close();}
});

test('PostgreSQL migration forces RLS with fail-closed transaction context on every tenant table',()=>{
 const sql=migrations[0].postgresSql;
 for(const name of ['organizations','memberships','projects','tasks','drafts','files','invitations','audit'])assert.ok(sql.includes(`ALTER TABLE novaworks.platform_${name} FORCE ROW LEVEL SECURITY`));
 assert.ok(sql.includes("NULLIF(current_setting('app.organization_id',true),'')"));
 // This checks policy generation, not execution against a PostgreSQL server.
});
