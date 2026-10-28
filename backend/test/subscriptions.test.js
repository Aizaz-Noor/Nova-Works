import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {configureBilling} from '../src/platform/billing/policy.js';
import {createBillingService} from '../src/platform/billing/service.js';
import {verifyPaddleSignature,normalizePaddleEvent} from '../src/platform/billing/paddle.js';
import {createCompanyAiService} from '../src/modules/companyAi/service.js';
import {createCompanyAiWorker} from '../src/modules/companyAi/worker.js';
import {createReportService} from '../src/modules/reports/service.js';
import {createApp} from '../src/app.js';
const policy=JSON.parse(readFileSync(new URL('./fixtures/subscription-policy.json',import.meta.url),'utf8'));
const bad=code=>e=>e.code===code;
const providerId=(prefix,char)=>`${prefix}_${char.repeat(26)}`;
async function setup(selectedPolicy=policy){
 const db=openDatabase(':memory:');await migratePlatform(db);let stamp=Date.now();const options={enabled:true,policy:selectedPolicy,clock:()=>stamp};configureBilling(db,options);
 const p=createPlatformService(db),billing=createBillingService(db),owner=await p.register({name:'Owner',email:'owner@subscription.test',password:'subscription-test-password'}),beta=await p.register({name:'Beta',email:'beta@subscription.test',password:'subscription-test-password'}),a=await p.createOrganization(owner.id,{name:'Alpha'}),b=await p.createOrganization(beta.id,{name:'Beta'}),customerId=providerId('ctm','a'),subscriptionId=providerId('sub','a');await billing.bind(owner.id,a.id,{customerId,subscriptionId});
 let counter=0;function event({status='active',plan='GROWTH',at=stamp,org=a.id,sub=subscriptionId,customer=customerId,end=stamp+30*86400000,id}={}){return normalizePaddleEvent({event_id:id||`evt_${String(++counter).padStart(26,'0')}`,event_type:'subscription.updated',occurred_at:new Date(at).toISOString(),data:{id:sub,customer_id:customer,status,custom_data:{novaworks_organization_id:org},items:[{quantity:1,price:{id:Object.keys(policy.pricePlans).find(key=>policy.pricePlans[key]===plan)||providerId('pri','x')}}],current_billing_period:{ends_at:new Date(end).toISOString()}}},selectedPolicy,{clock:()=>stamp});}
 return {db,p,billing,owner,beta,a,b,options,event,clock:()=>stamp,advance:ms=>{stamp+=ms;}};
}
test('subscriptions: trial expiry, bounded grace, cancellation, event replay/order/ties and recovery enforce service writes',async()=>{
 const s=await setup(),{db,p,billing,owner:o,a,event}=s;
 try{
  assert.equal((await billing.context(o.id,a.id)).status,'TRIAL');const saved=await p.createProject(o.id,a.id,{name:'Preserved project'});s.advance(14*86400000+1);assert.equal((await billing.context(o.id,a.id)).status,'EXPIRED');await assert.rejects(p.updateProject(o.id,a.id,saved.id,{name:'Blocked',version:saved.version}),bad('SUBSCRIPTION_READ_ONLY'));assert.equal((await p.exportProjects(o.id,a.id)).length,1);
  const active=event();assert.equal((await billing.apply(active)).applied,true);assert.equal((await billing.apply(active)).replayed,true);await assert.rejects(billing.apply({...active,status:'CANCELED'}),bad('BILLING_EVENT_CONFLICT'));assert.equal((await billing.context(o.id,a.id)).access,'WRITE');
  s.advance(1000);await billing.apply(event({status:'past_due'}));const grace=(await billing.context(o.id,a.id)).graceUntil;assert.equal((await billing.context(o.id,a.id)).status,'GRACE');s.advance(2*86400000);await billing.apply(event({status:'past_due'}));assert.equal((await billing.context(o.id,a.id)).graceUntil,grace);s.advance(86400000+1);await assert.rejects(p.createProject(o.id,a.id,{name:'No extension'}),bad('SUBSCRIPTION_READ_ONLY'));
  s.advance(1000);const cancelled=event({status:'canceled'});await billing.apply(cancelled);assert.equal((await billing.context(o.id,a.id)).status,'CANCELED');const stale=event({at:s.clock()-2000,status:'active'});assert.equal((await billing.apply(stale)).outcome,'IGNORED_OLDER');assert.equal((await billing.context(o.id,a.id)).status,'CANCELED');
  const tie=event({status:'active',at:Date.parse(cancelled.occurredAt)});assert.equal((await billing.apply(tie)).outcome,'RECONCILIATION_REQUIRED');assert.equal((await billing.context(o.id,a.id)).status,'RECONCILIATION_REQUIRED');s.advance(1000);await billing.apply(event());await p.createProject(o.id,a.id,{name:'Recovered'});assert.equal((await p.listProjects(o.id,a.id)).length,2);
  s.advance(1000);assert.equal((await billing.apply(event({plan:'UNMAPPED'}))).outcome,'RECONCILIATION_REQUIRED');assert.equal((await billing.context(o.id,a.id)).access,'READ_ONLY');
 }finally{db.close();}
});
test('subscriptions: seats serialize, plan AI allowance and report features apply; closed AI maintenance survives expiry',async()=>{
 const s=await setup(),{db,p,billing,owner:o,a,event}=s;let calls=0;
 const ai=createCompanyAiService(db,{extract:async()=>{calls++;return {projects:[]};}});
 try{
  await billing.apply(event({plan:'STARTER'}));const people=await Promise.all(['one','two','three'].map(name=>p.register({name,email:`${name}@seat.test`,password:'subscription-test-password'}))),invites=[];for(const person of people)invites.push(await p.invite(o.id,a.id,{email:person.email,role:'MEMBER'}));
  const results=await Promise.allSettled(people.map((person,i)=>p.acceptInvitation(person.id,a.id,invites[i].token)));assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.equal(results.find(r=>r.status==='rejected').reason.code,'SEAT_LIMIT');assert.equal((await billing.context(o.id,a.id)).seatsUsed,3);
  await assert.rejects(createReportService(db).get(o.id,a.id,'financial'),bad('PLAN_FEATURE'));assert.equal((await createReportService(db).get(o.id,a.id,'delivery')).kind,'delivery');
  const first=await ai.enqueue(o.id,a.id,{requestId:'one',transcript:'First'});await ai.run(o.id,a.id,first.id);const second=await ai.enqueue(o.id,a.id,{requestId:'two',transcript:'Second'});await assert.rejects(ai.run(o.id,a.id,second.id),bad('AI_QUOTA'));assert.equal(calls,1);assert.equal((await ai.list(o.id,a.id)).usage.limit,1);
  s.advance(1000);await billing.apply(event({status:'canceled',plan:'STARTER'}));const worker=createCompanyAiWorker(db,{userId:o.id,serviceOptions:{extract:async()=>{calls++;return {};}}});assert.equal((await worker.tick())[0].code,'SUBSCRIPTION_READ_ONLY');await worker.stop();assert.equal(calls,1);
  const review=await ai.get(o.id,a.id,first.id),discarded=await ai.discard(o.id,a.id,first.id,{version:review.version,reason:'Remove stale meeting'});assert.equal(discarded.status,'DISCARDED');assert.equal((await ai.redact(o.id,a.id,first.id,{version:discarded.version})).transcript,'');assert.equal((await p.listProjects(o.id,a.id)).length,0);
 }finally{db.close();}
});
test('subscriptions: provider binding prevents cross-company events; policy config cannot be silently disabled',async()=>{
 const s=await setup();try{
  await assert.rejects(s.billing.apply(s.event({org:s.b.id})),bad('BILLING_BINDING_MISMATCH'));assert.equal((await s.billing.context(s.beta.id,s.b.id)).status,'TRIAL');await assert.rejects(s.billing.details(s.owner.id,s.b.id),bad('TENANT_FORBIDDEN'));assert.throws(()=>configureBilling(s.db,{enabled:false}),/cannot change/);
  const row=s.db.prepare('SELECT COUNT(*) n FROM platform_billing_events').get();assert.equal(row.n,0);
  const invalidPolicy=structuredClone(policy);invalidPolicy.pricePlans[providerId('pri','a')]='constructor';assert.throws(()=>configureBilling({},{enabled:true,policy:invalidPolicy}),/Invalid billing price mapping/);
 }finally{s.db.close();}
});
test('subscriptions: authorized extraction already in flight may finish review after expiry, but cannot approve work',async()=>{
 const s=await setup();let release;const wait=new Promise(r=>release=r),draft={projects:[{name:'Reviewed scope',clientName:'Buyer',description:'Agreed scope',managerId:s.owner.id,deadline:'2099-12-31',tasks:[{title:'Task',description:'Agreed work',assigneeId:s.owner.id,deadline:'2099-12-01',estimatedHours:1}]}]},ai=createCompanyAiService(s.db,{extract:async()=>{await wait;return draft;}});
 try{
  const queued=await ai.enqueue(s.owner.id,s.a.id,{requestId:'expiring',transcript:'Already processing'}),running=ai.run(s.owner.id,s.a.id,queued.id);await new Promise(r=>setTimeout(r,10));s.advance(14*86400000+1);release();
  // The lease clock remains the real extraction clock; billing expiry alone must
  // not discard a response for a provider attempt that was already authorized.
  const review=await running;assert.equal(review.status,'REVIEW');await assert.rejects(ai.approve(s.owner.id,s.a.id,review.id,{version:review.version,draft:review.draft}),bad('SUBSCRIPTION_READ_ONLY'));assert.equal((await s.p.listProjects(s.owner.id,s.a.id)).length,0);
 }finally{s.db.close();}
});
test('subscriptions: module mutations honor configured features without removing retained reads',async()=>{
 const custom=structuredClone(policy);custom.plans.STARTER.features.projects=false;custom.plans.STARTER.features.crm=false;const s=await setup(custom);
 try{await s.billing.apply(s.event({plan:'STARTER'}));await assert.rejects(s.p.createProject(s.owner.id,s.a.id,{name:'Feature gated'}),bad('PLAN_FEATURE'));assert.deepEqual(await s.p.listProjects(s.owner.id,s.a.id),[]);}finally{s.db.close();}
});
test('Paddle HTTP: raw-body signatures, five-second tolerance, forged org, concurrent duplicates, and no customer self-upgrade route',async()=>{
 const s=await setup(),secret='local-signature-fixture-only-not-provider-secret',origin='http://127.0.0.1:3037';const app=createApp({db:s.db,erpEnabled:true,billingOptions:s.options,paddleWebhookSecret:secret,sessionSecret:'billing-session-fixture-at-least-32-characters',frontendOrigin:origin,production:false}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 function payload(org=s.a.id){return JSON.stringify({event_id:providerId('evt','a'),event_type:'subscription.updated',occurred_at:new Date(s.clock()).toISOString(),data:{id:providerId('sub','a'),customer_id:providerId('ctm','a'),status:'active',custom_data:{novaworks_organization_id:org},items:[{quantity:1,price:{id:providerId('pri','b')}}],current_billing_period:{ends_at:new Date(s.clock()+30*86400000).toISOString()}}});}
 function signature(raw,ts=Math.floor(s.clock()/1000)){return `ts=${ts};h1=${createHmac('sha256',secret).update(`${ts}:`).update(raw).digest('hex')}`;}
 async function send(raw,header=signature(raw)){const r=await fetch(base+'/api/billing/paddle-webhook',{method:'POST',headers:{'Content-Type':'application/json','Paddle-Signature':header},body:raw});return {status:r.status,body:await r.json()};}
 try{
  const raw=payload();assert.equal((await send(raw,'ts=1;h1='+'0'.repeat(64))).status,401);assert.equal((await send(raw,signature(raw,Math.floor(s.clock()/1000)-6))).status,401);assert.equal((await send(raw+' ',signature(raw))).status,401);assert.equal((await send(payload(s.b.id))).status,403);
  const accepted=await Promise.all([send(raw),send(raw)]);for(const r of accepted)assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(accepted.filter(r=>r.body.replayed).length,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_billing_events').get().n,1);
  assert.throws(()=>verifyPaddleSignature(Buffer.from(raw),signature(raw)+';ts=1234567890',secret,{clock:s.clock}),bad('INVALID_SIGNATURE'));
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:s.owner.email,password:'subscription-test-password'})}),cookie=login.headers.get('set-cookie').split(';')[0];assert.equal(login.status,200);
  const upgrade=await fetch(base+'/api/v1/billing/subscription',{method:'PATCH',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({planKey:'AGENCY_PRO',status:'ACTIVE'})});assert.ok([403,404].includes(upgrade.status));assert.equal((await s.billing.context(s.owner.id,s.a.id)).planKey,'GROWTH');
 }finally{await new Promise(r=>server.close(r));s.db.close();}
});
