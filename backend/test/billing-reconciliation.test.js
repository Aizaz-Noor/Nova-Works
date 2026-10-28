import {ApiError} from '../src/middleware/errorHandler.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {configureBilling} from '../src/platform/billing/policy.js';
import {createBillingService} from '../src/platform/billing/service.js';
import {normalizePaddleEvent} from '../src/platform/billing/paddle.js';
import {getPaddleSubscription} from '../src/platform/billing/provider.js';
import {createBillingReconciler} from '../src/platform/billing/reconciler.js';
const policy=JSON.parse(readFileSync(new URL('./fixtures/subscription-policy.json',import.meta.url),'utf8')),id=(prefix,char)=>`${prefix}_${char.repeat(26)}`,bad=code=>e=>e.code===code;
async function setup(){
 const db=openDatabase(':memory:');await migratePlatform(db);let stamp=Date.now(),eventNumber=0;const options={enabled:true,policy,clock:()=>stamp};configureBilling(db,options);const p=createPlatformService(db),[owner,admin,beta]=await Promise.all(['owner','admin','beta'].map(name=>p.register({name,email:`${name}@reconcile.test`,password:'reconciliation-test-password'}))),a=await p.createOrganization(owner.id,{name:'Alpha'}),b=await p.createOrganization(beta.id,{name:'Beta'}),invite=await p.invite(owner.id,a.id,{email:admin.email,role:'ADMIN'});await p.acceptInvitation(admin.id,a.id,invite.token);
 function data(changes={}){return {id:id('sub','a'),customer_id:id('ctm','a'),status:'active',updated_at:new Date(stamp).toISOString(),custom_data:{novaworks_organization_id:a.id},items:[{quantity:1,price:{id:id('pri','b')}}],current_billing_period:{ends_at:'2099-12-31T00:00:00.000Z'},...changes};}
 function event(raw,at=stamp){return normalizePaddleEvent({event_id:`evt_${String(++eventNumber).padStart(26,'0')}`,event_type:'subscription.updated',occurred_at:new Date(at).toISOString(),data:raw},policy,{clock:()=>stamp});}
 return {db,p,owner,admin,beta,a,b,options,data,event,clock:()=>stamp,advance:ms=>stamp+=ms};
}
test('billing operations: provider-verified provisioning, owner scope, idempotency and current-context replay',async()=>{
 const s=await setup();let raw=s.data(),calls=0;const billing=createBillingService(s.db,{getSubscription:async()=>{calls++;return structuredClone(raw);}});
 try{
  await assert.rejects(billing.operate(s.admin.id,s.a.id,'PROVISION',{requestId:'admin',subscriptionId:id('sub','a')}),bad('ROLE_FORBIDDEN'));assert.equal(calls,0);
  raw=s.data({custom_data:{novaworks_organization_id:s.b.id}});await assert.rejects(billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'wrong-org',subscriptionId:id('sub','a')}),bad('BILLING_BINDING_MISMATCH'));assert.equal((await billing.context(s.owner.id,s.a.id)).status,'TRIAL');
  raw=s.data();const first=await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'provision',subscriptionId:id('sub','a')});assert.equal(first.receipt.source,'PADDLE_GET');assert.equal(first.context.status,'ACTIVE');assert.equal((await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'provision',subscriptionId:id('sub','a')})).replayed,true);assert.equal(calls,2);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM platform_billing_events').get().n,0);
  s.advance(1000);await billing.apply(s.event(s.data({status:'canceled'})));const replay=await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'provision',subscriptionId:id('sub','a')});assert.equal(replay.context.status,'CANCELED');assert.equal(calls,2);
  s.advance(1000);raw=s.data();assert.equal((await billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'recover'})).context.status,'ACTIVE');await s.p.createProject(s.owner.id,s.a.id,{name:'Recovered work'});
  await assert.rejects(billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'tamper',status:'ACTIVE'}),bad('BAD_INPUT'));assert.equal((await billing.details(s.owner.id,s.a.id)).operations.length,3);
 }finally{s.db.close();}
});
test('billing operations: webhook during GET cannot be overwritten; stale/equal provider revisions fail closed and API can resolve ties',async()=>{
 const s=await setup();let raw=s.data(),duringRead=null;const billing=createBillingService(s.db,{getSubscription:async()=>{if(duringRead)await duringRead();return structuredClone(raw);}});
 try{
  await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'initial',subscriptionId:id('sub','a')});const original=structuredClone(raw);s.advance(1000);const canceled=s.data({status:'canceled'});duringRead=()=>billing.apply(s.event(canceled));
  await assert.rejects(billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'racing'}),bad('VERSION_CONFLICT'));assert.equal((await billing.context(s.owner.id,s.a.id)).status,'CANCELED');
  duringRead=null;raw=canceled;const retry=await billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'racing'});assert.equal(retry.context.status,'CANCELED');assert.equal(s.db.prepare("SELECT attempts FROM platform_billing_operations WHERE request_id='racing'").get().attempts,2);
  raw=original;assert.equal((await billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'stale'})).receipt.outcome,'IGNORED_STALE_SNAPSHOT');s.advance(1000);assert.equal((await billing.apply(s.event(original))).outcome,'IGNORED_OLDER_PROVIDER_REVISION');
  assert.equal((await billing.apply(s.event({...canceled,status:'active'}))).outcome,'RECONCILIATION_REQUIRED');raw=canceled;const resolved=await billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'resolve-tie'});assert.equal(resolved.context.status,'CANCELED');assert.equal(s.db.prepare('SELECT needs_reconciliation FROM platform_subscriptions WHERE organization_id=?').get(s.a.id).needs_reconciliation,0);
 }finally{s.db.close();}
});
test('billing operations: lease fencing, one in-flight command, bounded retries and safe provider errors',async()=>{
 const s=await setup();let release,mode='wait';const wait=new Promise(r=>release=r),billing=createBillingService(s.db,{getSubscription:async()=>{if(mode==='wait')return wait;if(mode==='error')throw new ApiError(503,'BILLING_PROVIDER_UNAVAILABLE','private provider credential must never escape');return s.data();}});
 try{
  const old=billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'leased',subscriptionId:id('sub','a')});await new Promise(r=>setTimeout(r,10));await assert.rejects(billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'other',subscriptionId:id('sub','a')}),bad('BILLING_OPERATION_BUSY'));
  s.advance(21000);mode='good';const latest=await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'leased',subscriptionId:id('sub','a')});release(s.data());await assert.rejects(old,bad('BILLING_LEASE_EXPIRED'));assert.equal(latest.context.status,'ACTIVE');assert.equal(s.db.prepare("SELECT status FROM platform_billing_operations WHERE request_id='leased'").get().status,'COMPLETE');
  mode='error';for(let n=0;n<3;n++)await assert.rejects(billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'failure'}),e=>e.code==='BILLING_PROVIDER_UNAVAILABLE'&&!e.message.includes('credential'));await assert.rejects(billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'failure'}),bad('BILLING_RETRY_LIMIT'));assert.equal(s.db.prepare("SELECT error_code FROM platform_billing_operations WHERE request_id='failure'").get().error_code,'BILLING_PROVIDER_UNAVAILABLE');
 }finally{s.db.close();}
});
test('billing operations: reconciliation never manufactures grace, and legacy011 webhook fingerprints replay unchanged',async()=>{
 const s=await setup();let raw=s.data({status:'past_due'});const billing=createBillingService(s.db,{getSubscription:async()=>raw});
 try{
  const overdue=await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'overdue',subscriptionId:id('sub','a')});assert.equal(overdue.context.access,'READ_ONLY');assert.equal(overdue.context.status,'PAST_DUE');const grace=overdue.context.graceUntil;s.advance(1000);raw=s.data({status:'past_due'});await billing.operate(s.owner.id,s.a.id,'RECONCILE',{requestId:'still-overdue'});assert.equal((await billing.context(s.owner.id,s.a.id)).graceUntil,grace);
  s.advance(1000);const legacyEvent=s.event(s.data());const legacy={...legacyEvent};delete legacy.providerUpdatedAt;await billing.apply(legacyEvent);assert.equal(s.db.prepare('SELECT event_hash FROM platform_billing_events WHERE event_id=?').get(legacyEvent.eventId).event_hash,createHash('sha256').update(JSON.stringify(legacy)).digest('hex'));assert.equal((await billing.apply({...legacyEvent,providerUpdatedAt:null})).replayed,true);
 }finally{s.db.close();}
});
test('Paddle read adapter: fixed hosts, GET-only, redirects rejected, bounded bodies, sanitized failures and no credential echoes',async()=>{
 const subscriptionId=id('sub','a');let observed;const result=await getPaddleSubscription(subscriptionId,{apiKey:'fixture-only-key',environment:'sandbox',fetchImpl:async(url,options)=>{observed={url,options};return new Response(JSON.stringify({data:{id:subscriptionId}}));}});assert.equal(result.id,subscriptionId);assert.equal(observed.url,`https://sandbox-api.paddle.com/subscriptions/${subscriptionId}`);assert.equal(observed.options.method,'GET');assert.equal(observed.options.redirect,'error');
 await assert.rejects(getPaddleSubscription(subscriptionId,{apiKey:'fixture-only-key',fetchImpl:async()=>new Response('secret provider body',{status:429})}),e=>e.status===503&&e.retryAfter===30&&!e.message.includes('secret'));
 await assert.rejects(getPaddleSubscription(subscriptionId,{apiKey:'fixture-only-key',fetchImpl:async()=>new Response('x'.repeat(524289))}),bad('BILLING_PROVIDER_INVALID_RESPONSE'));
 await assert.rejects(getPaddleSubscription('http://malicious.test',{apiKey:'fixture-only-key'}),bad('BAD_INPUT'));
 await assert.rejects(getPaddleSubscription(subscriptionId,{apiKey:'replace-disabled'}),bad('BILLING_PROVIDER_NOT_CONFIGURED'));
});
test('billing recovery: pre011 company enrollment and scoped periodic checks recover missed events without giving fresh overdue grace',async()=>{
 const s=await setup();let calls=0,raw=s.data(),getSubscription=async()=>{calls++;return raw;};const billing=createBillingService(s.db,{getSubscription});
 try{
  s.db.prepare('DELETE FROM platform_subscriptions WHERE organization_id=?').run(s.a.id);assert.equal((await billing.context(s.owner.id,s.a.id)).status,'UNCONFIGURED');
  await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'old-company',subscriptionId:id('sub','a')});assert.equal((await billing.context(s.owner.id,s.a.id)).status,'ACTIVE');
  const worker=createBillingReconciler(s.db,{userId:s.owner.id,providerOptions:{getSubscription}});await worker.tick();const afterCheck=calls;await worker.tick();assert.equal(calls,afterCheck);
  s.advance(3600000);raw=s.data({status:'canceled'});await worker.tick();assert.equal((await billing.context(s.owner.id,s.a.id)).status,'CANCELED');assert.equal((await billing.context(s.beta.id,s.b.id)).status,'TRIAL');await worker.stop();assert.deepEqual(await worker.tick(),[]);
 }finally{s.db.close();}
});
test('billing replacement: independently verify both records, require old provider cancellation and reset the subscription epoch',async()=>{
 const s=await setup();let previous=s.data(),replacement=s.data({id:id('sub','b'),customer_id:id('ctm','b')}),billing=createBillingService(s.db,{getSubscription:async target=>structuredClone(target===previous.id?previous:replacement)});
 try{
  await billing.operate(s.owner.id,s.a.id,'PROVISION',{requestId:'initial',subscriptionId:previous.id});const body={requestId:'replacement',subscriptionId:replacement.id,currentSubscriptionId:previous.id};
  await assert.rejects(billing.operate(s.owner.id,s.a.id,'REPLACE',body),bad('BILLING_CURRENT_SUBSCRIPTION_ACTIVE'));assert.equal(s.db.prepare('SELECT provider_subscription_id FROM platform_subscriptions WHERE organization_id=?').get(s.a.id).provider_subscription_id,previous.id);
  s.advance(1000);previous=s.data({status:'canceled'});const changed=await billing.operate(s.owner.id,s.a.id,'REPLACE',body);assert.equal(changed.receipt.outcome,'REPLACED');assert.equal(changed.context.status,'ACTIVE');assert.equal((await billing.operate(s.owner.id,s.a.id,'REPLACE',body)).replayed,true);
  const row=s.db.prepare('SELECT * FROM platform_subscriptions WHERE organization_id=?').get(s.a.id);assert.equal(row.provider_subscription_id,replacement.id);assert.equal(row.provider_updated_at,replacement.updated_at);assert.equal(row.last_event_at,replacement.updated_at);assert.equal(row.last_event_id,null);assert.equal(s.db.prepare("SELECT previous_subscription_id FROM platform_billing_operations WHERE request_id='replacement'").get().previous_subscription_id,previous.id);
  await assert.rejects(billing.apply(s.event(previous)),bad('BILLING_BINDING_MISMATCH'));
 }finally{s.db.close();}
});
