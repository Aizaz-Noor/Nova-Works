import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createCommentService} from '../src/modules/projects/commentService.js';
import {createApp} from '../src/app.js';
test('task comments: scoped authorship, retries, paging, immutable history and atomic audit',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const p=createPlatformService(db),tasks=createTaskService(db),comments=createCommentService(db),password='comments-test-password';
 const make=name=>p.register({name,email:`${name}@comments.test`,password});const owner=await make('owner'),member=await make('member'),peer=await make('peer'),manager=await make('manager'),outsider=await make('outsider');
 const org=await p.createOrganization(owner.id,{name:'Alpha'}),other=await p.createOrganization(outsider.id,{name:'Beta'});
 for(const [user,role]of [[member,'MEMBER'],[peer,'MEMBER'],[manager,'MANAGER']]){const i=await p.invite(owner.id,org.id,{email:user.email,role});await p.acceptInvitation(user.id,org.id,i.token);}
 const project=await p.createProject(owner.id,org.id,{name:'Delivery',managerId:manager.id});const task=await tasks.create(owner.id,org.id,{projectId:project.id,title:'Build',description:'Work',assigneeId:member.id,deadline:'2027-01-01',estimatedHours:1});
 try{
  const input={body:' First note\nSecond line ',requestId:randomUUID()},created=await comments.create(member.id,org.id,task.id,input);assert.equal(created.author_id,member.id);assert.equal(created.body,'First note\nSecond line');
  const retry=await Promise.all([comments.create(member.id,org.id,task.id,input),comments.create(member.id,org.id,task.id,input)]);assert.ok(retry.every(x=>x.id===created.id&&x.replayed));
  await assert.rejects(comments.create(member.id,org.id,task.id,{...input,body:'changed'}),e=>e.status===409);
  for(const who of [peer]){await assert.rejects(comments.list(who.id,org.id,task.id),e=>e.status===404);await assert.rejects(comments.create(who.id,org.id,task.id,{body:'no',requestId:randomUUID()}),e=>e.status===404);}
  await assert.rejects(comments.list(outsider.id,other.id,task.id),e=>e.status===404);await assert.rejects(comments.list(outsider.id,org.id,task.id),e=>e.status===403);
  for(const body of ['', ' ', 'x'.repeat(5001),'bad\0text'])await assert.rejects(comments.create(member.id,org.id,task.id,{body,requestId:randomUUID()}),e=>e.status===400);
  await assert.rejects(comments.create(member.id,org.id,task.id,{...input,authorId:owner.id}),e=>e.status===400);
  await comments.create(manager.id,org.id,task.id,{body:'Manager reply',requestId:randomUUID()});
  const page1=await comments.list(owner.id,org.id,task.id,{limit:1}),page2=await comments.list(owner.id,org.id,task.id,{limit:1,page:2});assert.equal(page1.pagination.total,2);assert.notEqual(page1.comments[0].id,page2.comments[0].id);
  await assert.rejects(comments.list(owner.id,org.id,task.id,{limit:101}),e=>e.status===400);
  assert.throws(()=>db.prepare('UPDATE platform_task_comments SET body=?').run('edited'),/append-only/);assert.throws(()=>db.prepare('DELETE FROM platform_task_comments').run(),/append-only/);
  db.exec("CREATE TRIGGER fail_comment_audit BEFORE INSERT ON platform_audit WHEN NEW.action='task.comment_added' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  await assert.rejects(comments.create(member.id,org.id,task.id,{body:'rolled back',requestId:randomUUID()}),/audit unavailable/);assert.equal((await comments.list(owner.id,org.id,task.id)).pagination.total,2);db.exec('DROP TRIGGER fail_comment_audit');
  const server=createApp({db,erpEnabled:true,sessionSecret:'comment-http-test-secret-at-least-32',frontendOrigin:'http://localhost:5173'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const base=`http://127.0.0.1:${server.address().port}`,headers={Origin:'http://localhost:5173','Content-Type':'application/json'};
   const login=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:member.email,password})});headers.Cookie=login.headers.get('set-cookie').split(';')[0];
   assert.equal((await fetch(base+'/api/v1/organizations/select',{method:'POST',headers,body:JSON.stringify({organizationId:org.id})})).status,200);
   const url=base+`/api/v1/tasks/${task.id}/comments`,payload=JSON.stringify({body:'HTTP note',requestId:randomUUID()});
   assert.equal((await fetch(url,{method:'POST',headers,body:payload})).status,201);assert.equal((await fetch(url,{method:'POST',headers,body:payload})).status,200);
   assert.equal((await(await fetch(url,{headers})).json()).pagination.total,3);
   assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'http://evil.test'},body:payload})).status,403);
  }finally{await new Promise(r=>server.close(r));}
 }finally{db.close();}
});


test('task comments: persisted per-company author quota preserves retries and resets at the boundary',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const p=createPlatformService(db),tasks=createTaskService(db);let time=Date.now();const first=createCommentService(db,{clock:()=>time}),second=createCommentService(db,{clock:()=>time});
 try{const user=await p.register({name:'Quota Owner',email:'quota@comments.test',password:'comment-quota-test-password'}),org=await p.createOrganization(user.id,{name:'Quota Company'}),other=await p.createOrganization(user.id,{name:'Other Company'});
  const make=async company=>{const project=await p.createProject(user.id,company.id,{name:'Delivery'});return tasks.create(user.id,company.id,{projectId:project.id,title:'Build',description:'Work',assigneeId:user.id,deadline:'2027-01-01',estimatedHours:1});};const task=await make(org),foreign=await make(other),input={body:'First',requestId:randomUUID()};
  const saved=await first.create(user.id,org.id,task.id,input);
  for(let n=1;n<29;n++)await first.create(user.id,org.id,task.id,{body:`Note ${n}`,requestId:randomUUID()});
  const concurrent=await Promise.allSettled([first.create(user.id,org.id,task.id,{body:'last A',requestId:randomUUID()}),second.create(user.id,org.id,task.id,{body:'last B',requestId:randomUUID()})]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.find(r=>r.status==='rejected').reason.code,'COMMENT_RATE_LIMITED');
  assert.equal((await second.create(user.id,org.id,task.id,input)).id,saved.id);assert.equal((await first.list(user.id,org.id,task.id)).pagination.total,30);
  await first.create(user.id,other.id,foreign.id,{body:'Separate company',requestId:randomUUID()});
  time+=599999;await assert.rejects(second.create(user.id,org.id,task.id,{body:'too early',requestId:randomUUID()}),e=>e.status===429&&e.retryAfter===1);
  time++;await second.create(user.id,org.id,task.id,{body:'New window',requestId:randomUUID()});assert.equal((await first.list(user.id,org.id,task.id)).pagination.total,31);
 }finally{db.close();}
});
