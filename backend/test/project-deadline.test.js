import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';

async function fixture(database=':memory:'){
 const db=openDatabase(database);await migratePlatform(db);
 const platform=createPlatformService(db),tasks=createTaskService(db),password='project-deadline-test-password';
 const make=name=>platform.register({name,email:`${name}@deadline.test`,password});
 const owner=await make('owner'),manager=await make('manager'),otherManager=await make('other-manager'),member=await make('member');
 const org=await platform.createOrganization(owner.id,{name:'Deadline company'});
 for(const user of [manager,otherManager,member]){const invitation=await platform.invite(owner.id,org.id,{email:user.email,role:user===member?'MEMBER':'MANAGER'});await platform.acceptInvitation(user.id,org.id,invitation.token);}
 const project=await platform.createProject(owner.id,org.id,{name:'Deadline project',managerId:manager.id});
 const task=await tasks.create(manager.id,org.id,{projectId:project.id,title:'Saved task',description:'History stays intact',assigneeId:member.id,deadline:'2027-04-10',estimatedHours:2});
 return{db,platform,tasks,owner,manager,otherManager,member,org,project,task};
}
const edit=(s,user,input)=>s.platform.updateProject(user,s.org.id,s.project.id,input);

test('project deadline updates, explicit clearing, and omitted preservation use the project revision',async()=>{
 const s=await fixture();try{
  const changed=await edit(s,s.owner.id,{deadline:'2027-04-10',version:1});assert.deepEqual([changed.deadline,changed.version],['2027-04-10',2]);
  const status=await edit(s,s.owner.id,{status:'ACTIVE',version:2});assert.deepEqual([status.deadline,status.status,status.version],['2027-04-10','ACTIVE',3]);
  const cleared=await edit(s,s.owner.id,{deadline:null,version:3});assert.deepEqual([cleared.deadline,cleared.version],[null,4]);
  assert.equal((await s.tasks.list(s.owner.id,s.org.id)).tasks[0].deadline,'2027-04-10');
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='project.updated'").get().n,3);
 }finally{s.db.close();}
});

test('corrected project deadline survives closing and reopening a disk database',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'novaworks-project-deadline-')),file=join(directory,'fixture.sqlite');let s;
 try{
  s=await fixture(file);await edit(s,s.owner.id,{deadline:'2027-04-10',version:1});const {owner,org,project}=s;s.db.close();
  let db=openDatabase(file);await migratePlatform(db);let reopened=createPlatformService(db),saved=(await reopened.listProjects(owner.id,org.id)).find(row=>row.id===project.id);assert.deepEqual([saved.deadline,saved.version],['2027-04-10',2]);await edit({...s,platform:reopened},owner.id,{deadline:null,version:saved.version});db.close();
  db=openDatabase(file);try{await migratePlatform(db);reopened=createPlatformService(db);saved=(await reopened.listProjects(owner.id,org.id)).find(row=>row.id===project.id);assert.deepEqual([saved.deadline,saved.version],[null,3]);}finally{db.close();}
 }finally{if(s)try{s.db.close();}catch{}rmSync(directory,{recursive:true,force:true});}
});

test('deadline shape and project update allowlist reject malformed requests without mutation',async()=>{
 const s=await fixture();try{
  for(const deadline of ['', ' 2027-04-10','2027-4-10','2027-02-29','2027-04-10T00:00:00Z',20270410,false,'0000-01-01',[],{}])
   await assert.rejects(edit(s,s.owner.id,{deadline,version:1}),e=>e.status===400&&e.code==='BAD_INPUT');
  for(const input of [null,[],new Date(),{version:1,managerId:s.owner.id},{version:1,unknown:true}])
   await assert.rejects(edit(s,s.owner.id,input),e=>e.status===400&&e.code==='BAD_INPUT');
  const project=(await s.platform.listProjects(s.owner.id,s.org.id))[0];assert.deepEqual([project.deadline,project.version],[null,1]);
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='project.updated'").get().n,0);
  const undated=await s.platform.createProject(s.owner.id,s.org.id,{name:'Calendar boundary'});
  const ancient=await s.platform.updateProject(s.owner.id,s.org.id,undated.id,{deadline:'0001-01-01',version:1});
  const leap=await s.platform.updateProject(s.owner.id,s.org.id,undated.id,{deadline:'2028-02-29',version:2});
  assert.deepEqual([ancient.deadline,leap.deadline,leap.version],['0001-01-01','2028-02-29',3]);
 }finally{s.db.close();}
});

test('deadline cannot precede the latest saved task date, including completed tasks',async()=>{
 const s=await fixture();try{
  const unrelated=await s.platform.createProject(s.owner.id,s.org.id,{name:'Other project'});
  await s.tasks.create(s.owner.id,s.org.id,{projectId:unrelated.id,title:'Other project task',description:'Must not affect bound',assigneeId:s.member.id,deadline:'2027-04-30',estimatedHours:1});
  await s.tasks.update(s.manager.id,s.org.id,s.task.id,{status:'DONE',version:1});
  await assert.rejects(edit(s,s.owner.id,{deadline:'2027-04-09',version:1}),e=>e.status===400&&e.code==='BAD_DEADLINE'&&e.message.includes('2027-04-10'));
  const project=(await s.platform.listProjects(s.owner.id,s.org.id))[0];assert.deepEqual([project.deadline,project.version],[null,1]);
  const equal=await edit(s,s.owner.id,{deadline:'2027-04-10',version:1});assert.equal(equal.deadline,'2027-04-10');
 }finally{s.db.close();}
});

test('project deadline correction keeps existing role, stale-version, and audit rollback behavior',async()=>{
 const s=await fixture();try{
  await assert.rejects(edit(s,s.otherManager.id,{deadline:'2027-04-10',version:1}),e=>e.status===403&&e.code==='ROLE_FORBIDDEN');
  await assert.rejects(edit(s,s.member.id,{deadline:'2027-04-10',version:1}),e=>e.status===403&&e.code==='ROLE_FORBIDDEN');
  const updated=await edit(s,s.manager.id,{deadline:'2027-04-10',version:1});assert.equal(updated.version,2);
  await assert.rejects(edit(s,s.owner.id,{deadline:null,version:1}),e=>e.status===409&&e.code==='VERSION_CONFLICT');
  s.db.exec("CREATE TRIGGER reject_deadline_audit BEFORE INSERT ON platform_audit WHEN NEW.action='project.updated' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  await assert.rejects(edit(s,s.owner.id,{deadline:null,version:2}),/audit unavailable/);
  const project=(await s.platform.listProjects(s.owner.id,s.org.id))[0];assert.deepEqual([project.deadline,project.version],['2027-04-10',2]);
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='project.updated'").get().n,1);
 }finally{s.db.close();}
});

test('task create and update continue enforcing a corrected project deadline',async()=>{
 const s=await fixture();try{
  await edit(s,s.owner.id,{deadline:'2027-04-10',version:1});
  const fields={projectId:s.project.id,title:'Later task',description:'Should fail',assigneeId:s.member.id,deadline:'2027-04-11',estimatedHours:1};
  await assert.rejects(s.tasks.create(s.manager.id,s.org.id,fields),e=>e.status===400&&e.code==='BAD_DEADLINE');
  await assert.rejects(s.tasks.update(s.manager.id,s.org.id,s.task.id,{deadline:'2027-04-11',version:1}),e=>e.status===400&&e.code==='BAD_DEADLINE');
  const task=(await s.tasks.list(s.owner.id,s.org.id)).tasks[0];assert.deepEqual([task.deadline,task.version],['2027-04-10',1]);
 }finally{s.db.close();}
});
