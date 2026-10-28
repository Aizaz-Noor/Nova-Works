import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createCompanyAiService} from '../src/modules/companyAi/service.js';
import {extractProjects} from '../src/services/aiService.js';
import {ApiError} from '../src/middleware/errorHandler.js';
import {createCompanyAiWorker,startCompanyAiWorker} from '../src/modules/companyAi/worker.js';
const bad=code=>e=>e.code===code;
const draft=id=>({projects:[{name:'Client delivery',clientName:'Client',description:'Agreed work',managerId:id,deadline:'2026-12-30',tasks:[{title:'Build',description:'Build agreed scope',assigneeId:id,deadline:'2026-12-20',estimatedHours:4}]}]});
async function setup(){const db=openDatabase(':memory:');await migratePlatform(db);const p=createPlatformService(db),owner=await p.register({name:'Owner',email:'owner@ai.test',password:'company-ai-password'}),beta=await p.register({name:'Beta',email:'beta@ai.test',password:'company-ai-password'}),member=await p.register({name:'Member',email:'member@ai.test',password:'company-ai-password'}),a=await p.createOrganization(owner.id,{name:'Alpha'}),b=await p.createOrganization(beta.id,{name:'Beta'}),invite=await p.invite(owner.id,a.id,{email:member.email,role:'MEMBER'});await p.acceptInvitation(member.id,a.id,invite.token);return {db,p,owner,beta,member,a,b};}
test('company AI: review before atomic approval, corrected values, tenant/role checks, replay and quota',async()=>{
 const s=await setup();let calls=0;const ai=createCompanyAiService(s.db,{dailyLimit:1,extract:async(transcript,team)=>{calls++;assert.equal(transcript,'Meeting');assert.deepEqual(Object.keys(team[0]).sort(),['id','name','role']);assert.equal(team.length,2);return draft(s.owner.id);}});
 try{
  const job=await ai.enqueue(s.owner.id,s.a.id,{requestId:'one',transcript:' Meeting '});assert.equal(job.status,'QUEUED');assert.equal((await ai.enqueue(s.owner.id,s.a.id,{requestId:'one',transcript:'Meeting'})).replayed,true);
  await assert.rejects(ai.enqueue(s.owner.id,s.a.id,{requestId:'one',transcript:'Changed'}),bad('REQUEST_REUSED'));
  await assert.rejects(ai.get(s.beta.id,s.b.id,job.id),bad('NOT_FOUND'));await assert.rejects(ai.get(s.member.id,s.a.id,job.id),bad('ROLE_FORBIDDEN'));
  const review=await ai.run(s.owner.id,s.a.id,job.id);assert.equal(review.status,'REVIEW');assert.equal((await s.p.listProjects(s.owner.id,s.a.id)).length,0);
  assert.equal((await ai.run(s.owner.id,s.a.id,job.id)).status,'REVIEW');assert.equal(calls,1);
  await assert.rejects(ai.approve(s.owner.id,s.a.id,job.id,{version:1,draft:review.draft}),bad('VERSION_CONFLICT'));
  const wrong=structuredClone(review.draft);wrong.projects[0].tasks[0].assigneeId=s.beta.id;await assert.rejects(ai.approve(s.owner.id,s.a.id,job.id,{version:review.version,draft:wrong}),bad('INVALID_AI_OUTPUT'));assert.equal((await s.p.listProjects(s.owner.id,s.a.id)).length,0);
  review.draft.projects[0].name='Reviewed name';const [first,second]=await Promise.all([ai.approve(s.owner.id,s.a.id,job.id,{version:review.version,draft:review.draft}),ai.approve(s.owner.id,s.a.id,job.id,{version:review.version,draft:review.draft})]);assert.equal(first.result.projects[0].name,'Reviewed name');assert.equal(second.replayed,true);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_tasks').get().n,1);
  assert.equal((await s.p.listProjects(s.owner.id,s.a.id))[0].version,1);
  assert.equal(s.db.prepare('SELECT version FROM platform_tasks').get().version,1);
  const next=await ai.enqueue(s.owner.id,s.a.id,{requestId:'two',transcript:'Next meeting'});await assert.rejects(ai.run(s.owner.id,s.a.id,next.id),bad('AI_QUOTA'));assert.equal((await ai.list(s.owner.id,s.a.id)).usage.attempts,1);
 }finally{s.db.close();}
});
test('company AI: provider failures, invalid editable output, expired lease recovery and stale worker fencing',async()=>{
 const s=await setup();let stamp=Date.now(),release;const slow=new Promise(r=>release=r);let calls=0;
 const ai=createCompanyAiService(s.db,{clock:()=>stamp,extract:async()=>{calls++;if(calls===1)return slow;return draft(s.owner.id);}});
 try{
  const job=await ai.enqueue(s.owner.id,s.a.id,{requestId:'slow',transcript:'Meeting'}),old=ai.run(s.owner.id,s.a.id,job.id);await new Promise(r=>setTimeout(r,20));await assert.rejects(ai.run(s.owner.id,s.a.id,job.id),bad('AI_BUSY'));stamp+=121000;
  assert.equal((await ai.get(s.owner.id,s.a.id,job.id)).retryable,true);assert.equal((await ai.run(s.owner.id,s.a.id,job.id)).status,'REVIEW');release(draft(s.owner.id));await assert.rejects(old,bad('AI_LEASE_EXPIRED'));assert.equal((await ai.list(s.owner.id,s.a.id)).usage.attempts,2);
  const failing=createCompanyAiService(s.db,{extract:async()=>{throw new ApiError(503,'AI_NOT_CONFIGURED','secret provider detail');}}),failed=await failing.enqueue(s.owner.id,s.a.id,{requestId:'failure',transcript:'Missing key'});const result=await failing.run(s.owner.id,s.a.id,failed.id);assert.equal(result.status,'FAILED');assert.equal(result.errorCode,'AI_NOT_CONFIGURED');assert.ok(!JSON.stringify(result).includes('secret'));
  const invalid=createCompanyAiService(s.db,{extract:async()=>({projects:[]})}),j=await invalid.enqueue(s.owner.id,s.a.id,{requestId:'invalid',transcript:'No agreed work'}),review=await invalid.run(s.owner.id,s.a.id,j.id);assert.equal(review.status,'REVIEW');assert.ok(review.issues.length);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_projects').get().n,0);
 }finally{s.db.close();}
});
test('company provider prompt uses company roles and strips credentials from directory',async()=>{
 let body;await extractProjects('Untrusted meeting',[{id:'owner',name:'Owner',role:'OWNER',email:'private',password_hash:'secret'}],{company:true,apiKey:'test-only',fetchImpl:async(url,input)=>{body=JSON.parse(input.body);return{ok:true,json:async()=>({choices:[{message:{content:'{"projects":[]}'}}]})};}});
 assert.ok(body.messages[0].content.includes('OWNER, ADMIN or MANAGER'));assert.ok(!JSON.stringify(body).includes('secret'));assert.ok(!JSON.stringify(body).includes('private'));
});
test('company AI: database save failure rolls back all records; quota serialization is shared across service instances',async()=>{
 const s=await setup(),options={dailyLimit:1,extract:async()=>draft(s.owner.id)},one=createCompanyAiService(s.db,options),two=createCompanyAiService(s.db,options);
 try{
  const a=await one.enqueue(s.owner.id,s.a.id,{requestId:'first',transcript:'First'}),b=await two.enqueue(s.owner.id,s.a.id,{requestId:'second',transcript:'Second'});
  const outcomes=await Promise.allSettled([one.run(s.owner.id,s.a.id,a.id),two.run(s.owner.id,s.a.id,b.id)]);assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1);assert.equal(outcomes.find(v=>v.status==='rejected').reason.code,'AI_QUOTA');
  const review=outcomes.find(v=>v.status==='fulfilled').value;s.db.exec("CREATE TRIGGER injected_failure BEFORE INSERT ON platform_tasks BEGIN SELECT RAISE(ABORT,'Injected storage failure'); END;");
  await assert.rejects(one.approve(s.owner.id,s.a.id,review.id,{version:review.version,draft:review.draft}),/Injected storage failure/);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_projects').get().n,0);assert.equal((await one.get(s.owner.id,s.a.id,review.id)).status,'REVIEW');
  s.db.exec('DROP TRIGGER injected_failure');assert.equal((await two.approve(s.owner.id,s.a.id,review.id,{version:review.version,draft:review.draft})).status,'APPROVED');
 }finally{s.db.close();}
});
test('company AI lifecycle: discard fences workers, frees queue, hides transcripts in every list row, and redaction preserves approved work',async()=>{
 const s=await setup();let release;const slow=new Promise(r=>release=r),ai=createCompanyAiService(s.db,{extract:async()=>slow});
 try{
  const first=await ai.enqueue(s.owner.id,s.a.id,{requestId:'one',transcript:'Confidential meeting one'});await ai.enqueue(s.owner.id,s.a.id,{requestId:'two',transcript:'Confidential meeting two'});
  const listed=await ai.list(s.owner.id,s.a.id);assert.equal(listed.jobs.length,2);for(const row of listed.jobs)assert.equal(Object.hasOwn(row,'transcript'),false);
  const processing=ai.run(s.owner.id,s.a.id,first.id);await new Promise(r=>setTimeout(r,10));const running=await ai.get(s.owner.id,s.a.id,first.id);
  await assert.rejects(ai.discard(s.member.id,s.a.id,first.id,{version:running.version,reason:'No longer needed'}),bad('ROLE_FORBIDDEN'));await assert.rejects(ai.discard(s.owner.id,s.a.id,first.id,{version:1,reason:'No longer needed'}),bad('VERSION_CONFLICT'));
  const discarded=await ai.discard(s.owner.id,s.a.id,first.id,{version:running.version,reason:'No longer needed'});assert.equal(discarded.status,'DISCARDED');assert.equal(discarded.retryable,false);release(draft(s.owner.id));await assert.rejects(processing,bad('AI_LEASE_EXPIRED'));
  await assert.rejects(ai.run(s.owner.id,s.a.id,first.id),bad('AI_DISCARDED'));assert.equal((await ai.discard(s.owner.id,s.a.id,first.id,{})).replayed,true);
  const redacted=await ai.redact(s.owner.id,s.a.id,first.id,{version:discarded.version});assert.equal(redacted.transcript,'');assert.equal(redacted.discardReason,null);assert.ok(redacted.redactedAt);assert.equal((await ai.redact(s.owner.id,s.a.id,first.id,{})).replayed,true);
  const second=(await ai.list(s.owner.id,s.a.id)).jobs.find(j=>j.id!==first.id),ready=await ai.run(s.owner.id,s.a.id,second.id);await assert.rejects(ai.redact(s.owner.id,s.a.id,second.id,{version:ready.version}),bad('AI_NOT_CLOSED'));
  const approved=await ai.approve(s.owner.id,s.a.id,second.id,{version:ready.version,draft:ready.draft});await assert.rejects(ai.discard(s.owner.id,s.a.id,second.id,{version:approved.version,reason:'Delete'}),bad('AI_APPROVED'));
  const removed=await ai.redact(s.owner.id,s.a.id,second.id,{version:approved.version});assert.equal(removed.draft,null);assert.equal(removed.result.projectCount,1);assert.deepEqual(removed.result.projectIds,[approved.result.projects[0].id]);assert.equal((await s.p.listProjects(s.owner.id,s.a.id)).length,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_tasks').get().n,1);assert.equal((await ai.approve(s.owner.id,s.a.id,second.id,{})).replayed,true);
 }finally{s.db.close();}
});
test('company worker: automatic queue drain without approval, tenant boundaries, competing workers, quota and graceful stop',async()=>{
 const s=await setup();let calls=0;const extract=async()=>{calls++;await new Promise(r=>setTimeout(r,10));return draft(s.owner.id);},options={userId:s.owner.id,serviceOptions:{extract,dailyLimit:1}},ai=createCompanyAiService(s.db,{extract});
 try{
  const alpha=await ai.enqueue(s.owner.id,s.a.id,{requestId:'alpha',transcript:'Alpha meeting'}),beta=await ai.enqueue(s.beta.id,s.b.id,{requestId:'beta',transcript:'Beta meeting'});
  const one=createCompanyAiWorker(s.db,options),two=createCompanyAiWorker(s.db,options);const [first,second]=await Promise.all([one.tick(),two.tick()]);assert.ok([...first,...second].some(r=>r.status==='REVIEW'));assert.equal(calls,1);assert.equal((await ai.get(s.owner.id,s.a.id,alpha.id)).status,'REVIEW');assert.equal((await ai.get(s.beta.id,s.b.id,beta.id)).status,'QUEUED');assert.equal((await s.p.listProjects(s.owner.id,s.a.id)).length,0);
  const third=await ai.enqueue(s.owner.id,s.a.id,{requestId:'third',transcript:'Third meeting'});assert.equal((await one.tick())[0].code,'AI_QUOTA');assert.equal((await ai.get(s.owner.id,s.a.id,third.id)).status,'QUEUED');await one.stop();assert.deepEqual(await one.tick(),[]);await two.stop();
  const memberWorker=createCompanyAiWorker(s.db,{userId:s.member.id,serviceOptions:{extract}});assert.deepEqual(await memberWorker.tick(),[]);await memberWorker.stop();
  // A scheduled worker actually processes independently of an HTTP run request.
  let resolveReady;const complete=new Promise(r=>resolveReady=r);const scheduled=startCompanyAiWorker(s.db,{userId:s.beta.id,intervalMs:10,serviceOptions:{extract:async()=>draft(s.beta.id)},onResult:resolveReady});await complete;await scheduled.stop();assert.equal((await ai.get(s.beta.id,s.b.id,beta.id)).status,'REVIEW');
 }finally{s.db.close();}
});
test('company worker: expired crash attempts stop automatically and failed provider work is not retried each poll',async()=>{
 const s=await setup();let calls=0;const ai=createCompanyAiService(s.db),worker=createCompanyAiWorker(s.db,{userId:s.owner.id,serviceOptions:{extract:async()=>{calls++;throw new Error('untrusted provider secret');}}});
 try{
  const job=await ai.enqueue(s.owner.id,s.a.id,{requestId:'crashed',transcript:'Crashed meeting'});s.db.prepare("UPDATE platform_ai_jobs SET status='RUNNING',attempts=3,lease_token='old',lease_until='2000-01-01' WHERE id=?").run(job.id);assert.equal((await worker.tick())[0].status,'FAILED');assert.equal((await ai.get(s.owner.id,s.a.id,job.id)).errorCode,'AI_RETRY_LIMIT');assert.equal(calls,0);
  const failJob=await ai.enqueue(s.owner.id,s.a.id,{requestId:'fails',transcript:'Failing meeting'});assert.equal((await worker.tick())[0].status,'FAILED');assert.equal(calls,1);assert.deepEqual(await worker.tick(),[]);assert.equal((await ai.get(s.owner.id,s.a.id,failJob.id)).status,'FAILED');await worker.stop();
 }finally{s.db.close();}
});
