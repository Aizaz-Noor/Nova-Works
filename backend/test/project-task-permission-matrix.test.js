import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createMemberAdministration} from '../src/platform/memberAdministration.js';
import {configureBilling} from '../src/platform/billing/policy.js';
import {createApp} from '../src/app.js';

test('versioned project/task HTTP combines company headers, roles, assignment, suspension and read-only policy',async()=>{
 const db=openDatabase(':memory:');let server;const password='IsolatedPermissions2026!',origin='http://localhost:5173';
 try{
  await migratePlatform(db);let now=Date.now();const policy=JSON.parse(readFileSync(new URL('./fixtures/subscription-policy.json',import.meta.url),'utf8')),billingOptions={enabled:true,policy,clock:()=>now};configureBilling(db,billingOptions);
  const p=createPlatformService(db),t=createTaskService(db),people={};
  for(const name of ['owner','admin','manager','member','peer','other'])people[name]=await p.register({name,email:`${name}@cas-matrix.test`,password});
  const {owner,admin,manager,member,peer,other}=people,a=await p.createOrganization(owner.id,{name:'Fictional Alpha'}),b=await p.createOrganization(other.id,{name:'Fictional Beta'});
  for(const [person,role]of [[admin,'ADMIN'],[manager,'MANAGER'],[member,'MEMBER'],[peer,'MEMBER']]){const invite=await p.invite(owner.id,a.id,{email:person.email,role});await p.acceptInvitation(person.id,a.id,invite.token);}
  let project=await p.createProject(owner.id,a.id,{name:'Managed delivery',managerId:manager.id}),task=await t.create(manager.id,a.id,{projectId:project.id,title:'Assigned work',description:'Fictional work',assigneeId:member.id,deadline:'2099-12-01',estimatedHours:1});
  const privateProject=await p.createProject(owner.id,a.id,{name:'Owner managed'});
  server=createApp({db,erpEnabled:true,billingOptions,sessionSecret:'isolated-matrix-session-secret-at-least-32',frontendOrigin:origin,production:false,loginLimit:100}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const clients={};for(const [name,person]of Object.entries(people)){
   let cookie='';const call=async(path,method='GET',body,company=a.id)=>{const response=await fetch(base+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),'X-NovaWorks-Organization':company},...(body!==undefined?{body:JSON.stringify(body)}:{})});const saved=response.headers.get('set-cookie');if(saved)cookie=saved.split(';')[0];return {status:response.status,data:await response.json()};};
   assert.equal((await call('/api/auth/login','POST',{email:person.email,password})).status,200);assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:name==='other'?b.id:a.id})).status,200);clients[name]=call;
  }
  const patchProject=(name,record,body={},company=a.id)=>clients[name](`/api/v1/projects/${record.id}`,'PATCH',{version:record.version,...body},company);
  const patchTask=(name,body={},company=a.id)=>clients[name](`/api/v1/tasks/${task.id}`,'PATCH',{version:task.version,...body},company);
  for(const name of ['owner','admin','manager']){const result=await patchProject(name,project,{status:'ACTIVE'});assert.equal(result.status,200);project=result.data;const updated=await patchTask(name,{status:'IN_PROGRESS'});assert.equal(updated.status,200);task=updated.data;}
  assert.equal((await patchProject('manager',privateProject,{status:'DONE'})).status,403);
  assert.equal((await patchProject('member',project,{status:'DONE'})).status,403);
  const own=await patchTask('member',{status:'DONE'});assert.equal(own.status,200);task=own.data;
  assert.equal((await patchTask('member',{title:'Forbidden managerial edit'})).status,400);
  assert.equal((await patchTask('peer',{status:'TODO'})).status,403);
  assert.equal((await patchProject('other',project,{status:'DONE'},b.id)).status,404);
  assert.equal((await patchTask('other',{status:'TODO'},b.id)).status,404);
  const auditCount=()=>db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action IN ('project.updated','task.updated')").get().n;const before=auditCount();
  for(const name of ['owner','admin','manager','member']){const denied=await patchTask(name,{status:'TODO'},b.id);assert.equal(denied.status,409);assert.equal(denied.data.error.code,'COMPANY_CONTEXT_CHANGED');}
  const stale=await patchTask('member',{version:1,status:'TODO'});assert.equal(stale.status,409);assert.equal(stale.data.error.code,'VERSION_CONFLICT');
  const members=createMemberAdministration(db);await members.transition(owner.id,a.id,member.id,{version:1,role:'MEMBER',status:'SUSPENDED'});
  assert.equal((await patchTask('member',{status:'TODO'})).status,403);
  const reassigned=await t.update(owner.id,a.id,task.id,{version:task.version,assigneeId:peer.id});task=reassigned;
  await members.transition(owner.id,a.id,member.id,{version:2,role:'MEMBER',status:'ACTIVE'});
  assert.equal((await patchTask('member',{status:'TODO'})).status,403);
  const auditAfterAssignment=auditCount();assert.equal(auditAfterAssignment,before+1);
  now+=15*86400000;
  for(const name of ['owner','admin','manager']){const denied=await patchProject(name,project,{status:'DONE'});assert.equal(denied.status,402);assert.equal(denied.data.error.code,'SUBSCRIPTION_READ_ONLY');}
  const locked=await patchTask('peer',{status:'TODO'});assert.equal(locked.status,402);assert.equal(locked.data.error.code,'SUBSCRIPTION_READ_ONLY');
  assert.equal(auditCount(),auditAfterAssignment);assert.equal(db.prepare('SELECT version FROM platform_tasks WHERE id=?').get(task.id).version,task.version);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));db.close();}
});
