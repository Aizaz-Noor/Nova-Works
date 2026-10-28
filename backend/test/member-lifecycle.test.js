import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createMemberAdministration} from '../src/platform/memberAdministration.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createCommentService} from '../src/modules/projects/commentService.js';
import {createCompanyAiService} from '../src/modules/companyAi/service.js';
import {configureBilling} from '../src/platform/billing/policy.js';
import {createApp} from '../src/app.js';
const rejected=code=>error=>error.code===code;
async function setup(){
 const db=openDatabase(':memory:');await migratePlatform(db);const p=createPlatformService(db),m=createMemberAdministration(db),password='member-lifecycle-test-password';
 const make=name=>p.register({name,email:`${name}@member.test`,password});
 const owner=await make('Owner'),admin=await make('Admin'),manager=await make('Manager'),worker=await make('Worker'),outsider=await make('Outsider');
 const a=await p.createOrganization(owner.id,{name:'Alpha'}),b=await p.createOrganization(outsider.id,{name:'Beta'});
 for(const [person,role,org,lead]of [[admin,'ADMIN',a,owner],[manager,'MANAGER',a,owner],[worker,'MEMBER',a,owner],[worker,'MEMBER',b,outsider]]){const invitation=await p.invite(lead.id,org.id,{email:person.email,role});await p.acceptInvitation(person.id,org.id,invitation.token);}
 return{db,p,m,password,owner,admin,manager,worker,outsider,a,b};
}
test('member transitions: bounded roles, company suspension, history, CAS races and atomic rollback',async()=>{
 const s=await setup(),{db,p,m,owner,admin,manager,worker,outsider,a,b}=s;
 try{
  const tasks=createTaskService(db),comments=createCommentService(db),project=await p.createProject(owner.id,a.id,{name:'Historical delivery',managerId:manager.id});
  const task=await tasks.create(owner.id,a.id,{projectId:project.id,title:'Preserve authorship',description:'Keep this work',assigneeId:worker.id,deadline:'2027-01-01',estimatedHours:2});
  const comment=await comments.create(worker.id,a.id,task.id,{requestId:randomUUID(),body:'Historical author'});
  await assert.rejects(m.list(worker.id,a.id),rejected('ROLE_FORBIDDEN'));
  await assert.rejects(m.list(owner.id,a.id,{limit:'0'}),rejected('BAD_INPUT'));
  assert.equal((await m.list(owner.id,a.id,{limit:'2'})).pagination.total,4);
  for(const [actor,target,role]of [[owner,owner,'ADMIN'],[admin,owner,'MEMBER'],[admin,admin,'MEMBER'],[admin,worker,'ADMIN'],[worker,manager,'MEMBER']])await assert.rejects(m.transition(actor.id,a.id,target.id,{version:1,role,status:'ACTIVE'}),rejected('ROLE_FORBIDDEN'));
  await assert.rejects(m.transition(owner.id,a.id,outsider.id,{version:1,role:'MEMBER',status:'SUSPENDED'}),rejected('NOT_FOUND'));
  const results=await Promise.allSettled([m.transition(owner.id,a.id,worker.id,{version:1,role:'MEMBER',status:'SUSPENDED'}),createMemberAdministration(db).transition(admin.id,a.id,worker.id,{version:1,role:'MANAGER',status:'ACTIVE'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'VERSION_CONFLICT');
  await assert.rejects(p.listProjects(worker.id,a.id),rejected('MEMBERSHIP_SUSPENDED'));assert.equal((await p.listProjects(worker.id,b.id)).length,0);
  assert.deepEqual((await p.listOrganizations(worker.id)).map(o=>o.id),[b.id]);
  assert.equal(db.prepare('SELECT author_id FROM platform_task_comments WHERE id=?').get(comment.id).author_id,worker.id);
  assert.equal(db.prepare('SELECT assignee_id FROM platform_tasks WHERE id=?').get(task.id).assignee_id,worker.id);
  await assert.rejects(tasks.create(owner.id,a.id,{projectId:project.id,title:'Invalid assignment',description:'Cannot assign suspended worker',assigneeId:worker.id,deadline:'2027-01-01',estimatedHours:1}),rejected('BAD_ASSIGNEE'));
  const invite=await p.invite(owner.id,a.id,{email:worker.email,role:'MEMBER'});await assert.rejects(p.acceptInvitation(worker.id,a.id,invite.token),rejected('ALREADY_MEMBER'));
  const before=db.prepare('SELECT COUNT(*) n FROM platform_audit').get().n;
  assert.equal((await m.transition(owner.id,a.id,worker.id,{version:2,role:'MEMBER',status:'SUSPENDED'})).member.version,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_audit').get().n,before);
  db.exec("CREATE TRIGGER reject_member_audit BEFORE INSERT ON platform_audit WHEN NEW.action LIKE 'MEMBER_TRANSITION:%' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  await assert.rejects(m.transition(owner.id,a.id,worker.id,{version:2,role:'MEMBER',status:'ACTIVE'}),/audit unavailable/);
  assert.equal(db.prepare('SELECT status FROM platform_memberships WHERE organization_id=? AND user_id=?').get(a.id,worker.id).status,'SUSPENDED');
  assert.equal(db.prepare('SELECT status FROM platform_member_access WHERE organization_id=? AND user_id=?').get(a.id,worker.id).status,'SUSPENDED');
  db.exec('DROP TRIGGER reject_member_audit');
  await m.transition(owner.id,a.id,worker.id,{version:2,role:'MEMBER',status:'ACTIVE'});assert.equal((await p.listProjects(worker.id,a.id)).length,1);
 }finally{db.close();}
});
test('security transitions remain available under read-only billing without freeing seats',async()=>{
 const s=await setup();try{
  const features=Object.fromEntries(['crm','projects','sales','timesheets','invoicing','ai','reports'].map(name=>[name,true]));
  configureBilling(s.db,{enabled:true,policy:{testOnly:true,trialDays:1,graceDays:0,initialPlan:'TEST',pricePlans:{},plans:{TEST:{seats:4,aiDaily:10,features}}}});
  // Existing company is deliberately unenrolled and read-only.
  await assert.rejects(s.p.createProject(s.owner.id,s.a.id,{name:'Blocked business write'}),rejected('SUBSCRIPTION_READ_ONLY'));
  await s.m.transition(s.owner.id,s.a.id,s.worker.id,{version:1,role:'MEMBER',status:'SUSPENDED'});
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_memberships WHERE organization_id=?').get(s.a.id).n,4);
  await s.m.transition(s.owner.id,s.a.id,s.worker.id,{version:2,role:'MEMBER',status:'ACTIVE'});
 }finally{s.db.close();}
});
test('suspending an AI actor fences in-flight provider finalization and approval rejects suspended assignees',async()=>{
 const s=await setup();try{
  let release,started;const ready=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);
  const draft={projects:[{name:'AI delivery',clientName:'Client',description:'Work',managerId:s.owner.id,deadline:'2027-01-02',tasks:[{title:'Work',description:'Build',assigneeId:s.worker.id,deadline:'2027-01-01',estimatedHours:2}]}]};
  const ai=createCompanyAiService(s.db,{extract:async()=>{started();await wait;return draft;}}),job=await ai.enqueue(s.admin.id,s.a.id,{requestId:'in-flight',transcript:'Meeting'});
  const pending=ai.run(s.admin.id,s.a.id,job.id);await ready;
  await s.m.transition(s.owner.id,s.a.id,s.admin.id,{version:1,role:'ADMIN',status:'SUSPENDED'});release();await assert.rejects(pending,rejected('MEMBERSHIP_SUSPENDED'));
  assert.equal(s.db.prepare('SELECT status FROM platform_ai_jobs WHERE id=?').get(job.id).status,'RUNNING');assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_projects').get().n,0);
  const ownerAi=createCompanyAiService(s.db,{extract:async()=>draft}),next=await ownerAi.enqueue(s.owner.id,s.a.id,{requestId:'review',transcript:'Next meeting'}),review=await ownerAi.run(s.owner.id,s.a.id,next.id);
  await s.m.transition(s.owner.id,s.a.id,s.worker.id,{version:1,role:'MEMBER',status:'SUSPENDED'});
  await assert.rejects(ownerAi.approve(s.owner.id,s.a.id,next.id,{version:review.version,draft}),rejected('INVALID_AI_OUTPUT'));
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_projects').get().n,0);
 }finally{s.db.close();}
});
test('existing HTTP sessions lose only suspended company access and regain it on reactivation',async()=>{
 const s=await setup(),origin='http://localhost:5173',server=createApp({db:s.db,erpEnabled:true,frontendOrigin:origin,sessionSecret:'member-http-session-fixture-only-long-secret'}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,login=async person=>{const headers={Origin:origin,'Content-Type':'application/json'},response=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:person.email,password:s.password})});assert.equal(response.status,200);headers.Cookie=response.headers.get('set-cookie').split(';')[0];return headers;};
  const worker=await login(s.worker),owner=await login(s.owner),post=(headers,path,body)=>fetch(base+'/api/v1'+path,{method:'POST',headers,body:JSON.stringify(body)});
  assert.equal((await post(worker,'/organizations/select',{organizationId:s.a.id})).status,200);assert.equal((await post(owner,'/organizations/select',{organizationId:s.a.id})).status,200);
  assert.equal((await post(owner,`/member-administration/${s.worker.id}/transition`,{version:1,role:'MEMBER',status:'SUSPENDED'})).status,200);
  for(const path of ['/projects','/tasks','/reports/delivery','/notifications','/member-administration'])assert.equal((await fetch(base+'/api/v1'+path,{headers:worker})).status,403,path);
  assert.equal((await fetch(base+'/api/auth/me',{headers:worker})).status,200);
  assert.equal((await post(worker,'/organizations/select',{organizationId:s.b.id})).status,200);
  assert.equal((await fetch(base+'/api/v1/projects',{headers:worker})).status,200);
  assert.equal((await post(owner,`/member-administration/${s.worker.id}/transition`,{version:2,role:'MEMBER',status:'ACTIVE'})).status,200);
  assert.equal((await post(worker,'/organizations/select',{organizationId:s.a.id})).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));s.db.close();}
});
