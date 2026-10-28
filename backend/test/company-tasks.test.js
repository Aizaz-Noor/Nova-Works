import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createApp} from '../src/app.js';

test('company task flow enforces assigned members, project managers, tenant scope and persistence',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),tasks=createTaskService(db);
 const password='company-task-test-password';
 const make=(name)=>platform.register({name,email:`${name}@tasks.test`,password});
 const owner=await make('owner'),member=await make('member'),other=await make('other'),manager=await make('manager');
 const alpha=await platform.createOrganization(owner.id,{name:'Alpha'}),beta=await platform.createOrganization(other.id,{name:'Beta'});
 for(const [person,role]of[[member,'MEMBER'],[manager,'MANAGER']]){const invite=await platform.invite(owner.id,alpha.id,{email:person.email,role});await platform.acceptInvitation(person.id,alpha.id,invite.token);}
 const project=await platform.createProject(owner.id,alpha.id,{name:'Client delivery',managerId:manager.id,deadline:'2027-01-30'});
 const owned=await platform.createProject(owner.id,alpha.id,{name:'Owner project'});
 const input={projectId:project.id,title:'Implement API',description:'Tenant-safe API',assigneeId:member.id,deadline:'2027-01-20',estimatedHours:8};
 try{
  const task=await tasks.create(manager.id,alpha.id,input);assert.equal(task.status,'TODO');
  assert.equal((await tasks.list(member.id,alpha.id)).pagination.total,1);assert.equal((await tasks.list(other.id,beta.id)).pagination.total,0);
  await assert.rejects(tasks.create(member.id,alpha.id,input),e=>e.status===403);
  await assert.rejects(tasks.create(manager.id,alpha.id,{...input,projectId:owned.id}),e=>e.status===403);
  await assert.rejects(tasks.create(owner.id,alpha.id,{...input,assigneeId:other.id}),e=>e.code==='BAD_ASSIGNEE');
  await assert.rejects(tasks.create(owner.id,alpha.id,{...input,deadline:'2027-02-01'}),e=>e.code==='BAD_DEADLINE');
  await assert.rejects(tasks.create(owner.id,alpha.id,{...input,estimatedHours:Infinity}),e=>e.code==='BAD_HOURS');
  await assert.rejects(tasks.update(other.id,beta.id,task.id,{status:'DONE',version:task.version}),e=>e.status===404);
  await assert.rejects(tasks.update(member.id,alpha.id,task.id,{assigneeId:owner.id,version:task.version}),e=>e.status===400&&e.code==='BAD_INPUT');
  const memberUpdate=await tasks.update(member.id,alpha.id,task.id,{status:'IN_PROGRESS',version:task.version});assert.equal(memberUpdate.status,'IN_PROGRESS');
  assert.equal((await tasks.list(member.id,alpha.id,{status:'TODO'})).pagination.total,0);
  const managerUpdate=await tasks.update(manager.id,alpha.id,task.id,{estimatedHours:10,status:'DONE',version:memberUpdate.version});assert.equal(managerUpdate.estimated_hours,10);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='task.updated'").get().n,2);
  const origin='http://localhost:5173',server=createApp({db,erpEnabled:true,sessionSecret:'company-tasks-test-secret-at-least-32',frontendOrigin:origin}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{
   const base=`http://127.0.0.1:${server.address().port}`;const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:member.email,password})});const cookie=login.headers.get('set-cookie').split(';')[0];
   const headers={Origin:origin,'Content-Type':'application/json',Cookie:cookie};
   assert.equal((await fetch(base+'/api/v1/organizations/select',{method:'POST',headers,body:JSON.stringify({organizationId:alpha.id})})).status,200);
   const list=await(await fetch(base+'/api/v1/tasks',{headers})).json();assert.equal(list.tasks[0].id,task.id);assert.equal(list.tasks[0].status,'DONE');
   assert.equal((await fetch(base+`/api/v1/tasks/${task.id}`,{method:'PATCH',headers,body:JSON.stringify({status:'TODO'})})).status,400);
   const stale=await fetch(base+`/api/v1/tasks/${task.id}`,{method:'PATCH',headers,body:JSON.stringify({status:'IN_PROGRESS',version:memberUpdate.version})});assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'VERSION_CONFLICT');
   assert.equal((await fetch(base+`/api/v1/tasks/${task.id}`,{method:'PATCH',headers,body:JSON.stringify({status:'TODO',version:managerUpdate.version})})).status,200);
  }finally{await new Promise(r=>server.close(r));}
 }finally{db.close();}
});
