import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform,migrations} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';

async function fixture(){
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),tasks=createTaskService(db),password='project-version-test-password',make=name=>platform.register({name,email:`${name}@versions.test`,password});
 const owner=await make('owner'),member=await make('member'),peer=await make('peer'),org=await platform.createOrganization(owner.id,{name:'Version company'});
 for(const user of [member,peer]){const invitation=await platform.invite(owner.id,org.id,{email:user.email,role:'MEMBER'});await platform.acceptInvitation(user.id,org.id,invitation.token);}
 const project=await platform.createProject(owner.id,org.id,{name:'Original project'}),task=await tasks.create(owner.id,org.id,{projectId:project.id,title:'Original task',description:'Task description',assigneeId:member.id,deadline:'2027-01-01',estimatedHours:2});
 return{db,platform,tasks,owner,member,peer,org,project,task};
}

test('ERP project and task PATCH use full-record compare-and-swap and retain role checks',async()=>{
 const s=await fixture();try{
  assert.equal(s.project.version,1);assert.equal(s.task.version,1);
  const projectEdit=await s.platform.updateProject(s.owner.id,s.org.id,s.project.id,{name:'Reviewed project',version:s.project.version});
  assert.equal(projectEdit.version,2);
  await assert.rejects(s.platform.updateProject(s.owner.id,s.org.id,s.project.id,{name:'Original project',status:'DONE',version:s.project.version}),e=>e.status===409&&e.code==='VERSION_CONFLICT');
  const projectAfter=(await s.platform.listProjects(s.owner.id,s.org.id)).find(row=>row.id===s.project.id);assert.deepEqual([projectAfter.name,projectAfter.status,projectAfter.version],['Reviewed project','PLANNED',2]);
  const taskEdit=await s.tasks.update(s.owner.id,s.org.id,s.task.id,{title:'Reviewed task',version:s.task.version});assert.equal(taskEdit.version,2);
  await assert.rejects(s.tasks.update(s.member.id,s.org.id,s.task.id,{status:'DONE',version:s.task.version}),e=>e.status===409&&e.code==='VERSION_CONFLICT');
  const taskAfter=(await s.tasks.list(s.owner.id,s.org.id)).tasks.find(row=>row.id===s.task.id);assert.deepEqual([taskAfter.title,taskAfter.status,taskAfter.version],['Reviewed task','TODO',2]);
  await assert.rejects(s.tasks.update(s.peer.id,s.org.id,s.task.id,{status:'DONE',version:1}),e=>e.status===403&&e.code==='ROLE_FORBIDDEN');
  for(const version of [undefined,0,-1,1.5,'2',Number.MAX_SAFE_INTEGER+1]){
   const body=version===undefined?{name:'invalid'}:{name:'invalid',version};
   await assert.rejects(s.platform.updateProject(s.owner.id,s.org.id,s.project.id,body),e=>e.status===400&&e.code==='BAD_INPUT');
   const taskBody=version===undefined?{status:'DONE'}:{status:'DONE',version};
   await assert.rejects(s.tasks.update(s.member.id,s.org.id,s.task.id,taskBody),e=>e.status===400&&e.code==='BAD_INPUT');
  }
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action IN ('project.updated','task.updated')").get().n,2);
 }finally{s.db.close();}
});

test('project and task changes roll back when audit insertion fails',async()=>{
 const s=await fixture();try{
  s.db.exec("CREATE TRIGGER reject_version_audit BEFORE INSERT ON platform_audit WHEN NEW.action IN ('project.updated','task.updated') BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  await assert.rejects(s.platform.updateProject(s.owner.id,s.org.id,s.project.id,{name:'Must roll back',version:s.project.version}),/audit unavailable/);
  await assert.rejects(s.tasks.update(s.owner.id,s.org.id,s.task.id,{title:'Must roll back',version:s.task.version}),/audit unavailable/);
  const project=(await s.platform.listProjects(s.owner.id,s.org.id)).find(row=>row.id===s.project.id),task=(await s.tasks.list(s.owner.id,s.org.id)).tasks.find(row=>row.id===s.task.id);
  assert.deepEqual([project.name,project.version,task.title,task.version],['Original project',1,'Original task',1]);
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action IN ('project.updated','task.updated')").get().n,0);
 }finally{s.db.close();}
});

test('migration 025 upgrades populated 024 rows to revision 1 without changing old checksums',async()=>{
 const db=openDatabase(':memory:');try{
  const prior=migrations.slice(0,-1);db.exec('CREATE TABLE platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');
  for(const migration of prior){db.exec(migration.sql);db.prepare('INSERT INTO platform_migrations(version,checksum,applied_at) VALUES(?,?,?)').run(migration.version,createHash('sha256').update(migration.sql).digest('hex'),'fixture');}
  const platform=createPlatformService(db),user=await platform.register({name:'legacy owner',email:'legacy@versions.test',password:'project-version-test-password'}),org=await platform.createOrganization(user.id,{name:'Populated 024'}),project=await platform.createProject(user.id,org.id,{name:'Legacy project'}),tasks=createTaskService(db),task=await tasks.create(user.id,org.id,{projectId:project.id,title:'Legacy task',description:'Existing values',assigneeId:user.id,deadline:'2027-01-01',estimatedHours:2});
  const oldChecksums=db.prepare('SELECT version,checksum FROM platform_migrations ORDER BY version').all();
  const migration=migrations.at(-1);db.exec(migration.sql);db.prepare('INSERT INTO platform_migrations(version,checksum,applied_at) VALUES(?,?,?)').run(migration.version,createHash('sha256').update(migration.sql).digest('hex'),'fixture');
  assert.deepEqual(db.prepare('SELECT version,checksum FROM platform_migrations WHERE version < ? ORDER BY version').all(migration.version),oldChecksums);
  assert.deepEqual({...db.prepare('SELECT name,status,version FROM platform_projects WHERE id=?').get(project.id)},{name:'Legacy project',status:'PLANNED',version:1});
  assert.deepEqual({...db.prepare('SELECT title,description,status,version FROM platform_tasks WHERE id=?').get(task.id)},{title:'Legacy task',description:'Existing values',status:'TODO',version:1});
  const before=db.prepare('SELECT COUNT(*) n FROM platform_migrations').get().n;assert.equal(db.prepare('SELECT version FROM platform_migrations WHERE version=?').get(migration.version).version,migration.version);assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_migrations').get().n,before);
 }finally{db.close();}
});
