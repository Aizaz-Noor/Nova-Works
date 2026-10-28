import {randomUUID} from 'node:crypto';
import {createPlatformService} from '../service.js';
import {billingConfiguration,initializeCompanyTrial,subscriptionState} from './policy.js';
import {normalizePaddleSubscription} from './paddle.js';
import {getPaddleSubscription,paddleApiConfigured} from './provider.js';
import {ApiError} from '../../middleware/errorHandler.js';
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const safeCodes=['BILLING_PROVIDER_NOT_CONFIGURED','BILLING_PROVIDER_NOT_FOUND','BILLING_PROVIDER_UNAVAILABLE','BILLING_PROVIDER_TIMEOUT','BILLING_PROVIDER_INVALID_RESPONSE','BILLING_BINDING_MISMATCH','VERSION_CONFLICT','BILLING_LEASE_EXPIRED','INVALID_BILLING_EVENT','BINDING_EXISTS','BILLING_CURRENT_SUBSCRIPTION_ACTIVE'];
export function createBillingOperations(db,{getSubscription=getPaddleSubscription}={}){
 if(typeof getSubscription!=='function')throw new Error('A provider reader function is required');
 const platform=createPlatformService(db),t=name=>`${db.kind==='postgres'?'novaworks.':''}platform_${name}`,available=()=>billingConfiguration(db).enabled&&(getSubscription!==getPaddleSubscription||paddleApiConfigured()),now=()=>new Date(billingConfiguration(db).clock()).toISOString();
 const owner=c=>{if(c.member?.role!=='OWNER')fail(403,'ROLE_FORBIDDEN','Only the company owner can verify or reconcile a subscription');};
 const tx=(u,o,work)=>platform.transaction(u,o,async c=>{owner(c);return work(c);});
 const audit=(c,action,id)=>c.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[c.organizationId,randomUUID(),c.userId,action,id,now()]);
 const subscription=async c=>(await c.query(`SELECT * FROM ${t('subscriptions')} WHERE organization_id=?`,[c.organizationId])).rows[0];
 const command=async(c,id)=>(await c.query(`SELECT * FROM ${t('billing_operations')} WHERE organization_id=? AND request_id=?`,[c.organizationId,id])).rows[0];
 return {available,
  async execute(user,org,operation,input){
   if(!['PROVISION','RECONCILE','REPLACE'].includes(operation))fail(400,'BAD_INPUT','Unknown billing operation');
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!(operation==='PROVISION'?['requestId','subscriptionId']:operation==='REPLACE'?['requestId','subscriptionId','currentSubscriptionId']:['requestId']).includes(k))||typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>100||input.requestId.includes('\0'))fail(400,'BAD_INPUT','Provide a request ID and supported billing fields');
   if(operation!=='RECONCILE'&&!/^sub_[a-z\d]{26}$/.test(input.subscriptionId||''))fail(400,'BAD_INPUT','Provide a valid existing provider subscription ID');
   if(operation==='REPLACE'&&!/^sub_[a-z\d]{26}$/.test(input.currentSubscriptionId||''))fail(400,'BAD_INPUT','Provide the current binding for replacement confirmation');
   const config=billingConfiguration(db);if(!config.enabled)fail(503,'BILLING_DISABLED','Explicit billing configuration is required');
   const claim=await tx(user,org,async c=>{
    const row=await subscription(c),old=await command(c,input.requestId),target=operation==='RECONCILE'?row?.provider_subscription_id:input.subscriptionId;
    if(old&&(old.operation!==operation||old.requested_subscription_id!==target||operation==='REPLACE'&&old.previous_subscription_id!==input.currentSubscriptionId))fail(409,'REQUEST_REUSED','This request ID belongs to another billing operation');
    if(old?.status==='COMPLETE')return {replay:{...JSON.parse(old.result_json),context:{organizationId:org,...await subscriptionState(db,c.query,org),seatsUsed:Number((await c.query(`SELECT COUNT(*) AS n FROM ${t('memberships')} WHERE organization_id=?`,[org])).rows[0].n)},replayed:true}};
    if(!available())fail(503,'BILLING_PROVIDER_NOT_CONFIGURED','Provider subscription lookup is not configured');
    if(!target)fail(409,'BILLING_NOT_BOUND','Verify and link an existing subscription before reconciling');
    if(operation==='REPLACE'&&(!row?.provider_subscription_id||row.provider_subscription_id!==input.currentSubscriptionId||row.provider_subscription_id===target))fail(409,'VERSION_CONFLICT','Current subscription binding changed; reload before replacement');
    if(operation!=='REPLACE'&&row?.provider_subscription_id&&row.provider_subscription_id!==target)fail(409,'BINDING_EXISTS','Subscription replacement needs a separately verified workflow');
    if(old?.status==='RUNNING'&&old.lease_until>now())fail(409,'BILLING_OPERATION_BUSY','This billing operation is already running; retry the same request');
    if(old?.attempts>=3)fail(429,'BILLING_RETRY_LIMIT','This request reached its retry limit; review the failure before starting another');
    if((await c.query(`SELECT request_id FROM ${t('billing_operations')} WHERE organization_id=? AND status='RUNNING' AND lease_until>?`,[org,now()])).rows.length)fail(409,'BILLING_OPERATION_BUSY','Another company billing lookup is already running');
    const since=new Date(config.clock()-60000).toISOString(),starts=(await c.query(`SELECT COALESCE(SUM(attempts),0) AS n FROM ${t('billing_operations')} WHERE organization_id=? AND updated_at>=?`,[org,since])).rows[0];if(Number(starts.n)>=10)fail(429,'BILLING_LOOKUP_LIMIT','Company billing lookup limit reached; wait a minute before retrying');
    const token=randomUUID(),lease=new Date(config.clock()+20000).toISOString();
    if(old)await c.query(`UPDATE ${t('billing_operations')} SET status='RUNNING',attempts=attempts+1,lease_token=?,lease_until=?,base_version=?,error_code=NULL,updated_at=? WHERE organization_id=? AND request_id=?`,[token,lease,row?.version||0,now(),org,input.requestId]);
    else await c.query(`INSERT INTO ${t('billing_operations')}(organization_id,request_id,operation,requested_subscription_id,previous_subscription_id,created_by,status,lease_token,lease_until,base_version,created_at,updated_at) VALUES(?,?,?,?,?,?,'RUNNING',?,?,?,?,?)`,[org,input.requestId,operation,target,row?.provider_subscription_id||null,user,token,lease,row?.version||0,now(),now()]);
    await audit(c,'billing.lookup_started',input.requestId);return {token,target,previous:row?.provider_subscription_id||null,customer:row?.provider_customer_id||null,baseVersion:row?.version||0};
   });
   if(claim.replay)return claim.replay;
   try{
    // External GET runs after the claim transaction/connection has been released.
    const [raw,previousRaw]=operation==='REPLACE'?await Promise.all([getSubscription(claim.target),getSubscription(claim.previous)]):[await getSubscription(claim.target),null];if(raw?.id!==claim.target)fail(502,'BILLING_PROVIDER_INVALID_RESPONSE','Provider returned a different subscription');
    const fresh=normalizePaddleSubscription(raw,config.policy,{clock:config.clock});if(!fresh.providerUpdatedAt)fail(502,'BILLING_PROVIDER_INVALID_RESPONSE','Provider response has no valid revision timestamp');
    if(fresh.organizationId!==org)fail(403,'BILLING_BINDING_MISMATCH','Provider subscription is not assigned to this company');
    if(operation==='REPLACE'){
     if(previousRaw?.id!==claim.previous)fail(502,'BILLING_PROVIDER_INVALID_RESPONSE','Provider returned a different prior subscription');
     const previous=normalizePaddleSubscription(previousRaw,config.policy,{clock:config.clock});
     if(previous.organizationId!==org||previous.customerId!==claim.customer||!previous.providerUpdatedAt)fail(403,'BILLING_BINDING_MISMATCH','Prior subscription ownership could not be verified');
     if(previous.status!=='CANCELED')fail(409,'BILLING_CURRENT_SUBSCRIPTION_ACTIVE','The provider must show the previous subscription as canceled before replacement');
    }
    return await tx(user,org,async c=>{
     const pending=await command(c,input.requestId);if(pending?.status!=='RUNNING'||pending.lease_token!==claim.token||pending.lease_until<=now())fail(409,'BILLING_LEASE_EXPIRED','Billing lookup lease expired; retry the same request');
     let row=await subscription(c);if((row?.version||0)!==claim.baseVersion)fail(409,'VERSION_CONFLICT','Subscription changed during provider lookup. Retry for a fresh snapshot.');
     if(row?.provider_subscription_id&&(operation==='REPLACE'?row.provider_subscription_id!==claim.previous:row.provider_subscription_id!==fresh.subscriptionId||row.provider_customer_id!==fresh.customerId))fail(403,'BILLING_BINDING_MISMATCH','Provider subscription does not match the recorded binding');
     let outcome='RECONCILED';
     if(operation!=='REPLACE'&&row?.provider_updated_at&&fresh.providerUpdatedAt<row.provider_updated_at)outcome='IGNORED_STALE_SNAPSHOT';
     else{
      const needs=!fresh.planKey||['ACTIVE','TRIAL'].includes(fresh.status)&&!fresh.validUntil;
      const same=row&&row.provider_subscription_id===fresh.subscriptionId&&row.provider_customer_id===fresh.customerId&&row.status===fresh.status&&row.plan_key===fresh.planKey&&row.valid_until===fresh.validUntil&&row.provider_updated_at===fresh.providerUpdatedAt&&!row.needs_reconciliation&&!needs;
      if(same)outcome='VERIFIED_UNCHANGED';
      else{
       if(!row){await initializeCompanyTrial(db,c);row=await subscription(c);}
       // A newly discovered overdue snapshot does not create a fresh grace period.
       const since=fresh.status==='PAST_DUE'?(operation!=='REPLACE'&&row.status==='PAST_DUE'&&row.past_due_since?row.past_due_since:new Date(config.clock()-config.policy.graceDays*86400000).toISOString()):null;
       const watermark=operation!=='REPLACE'&&row.last_event_at&&row.last_event_at>fresh.providerUpdatedAt?row.last_event_at:fresh.providerUpdatedAt;
       await c.query(`UPDATE ${t('subscriptions')} SET provider_customer_id=?,provider_subscription_id=?,plan_key=?,status=?,valid_until=?,past_due_since=?,provider_updated_at=?,last_event_at=?,last_event_id=?,needs_reconciliation=?,version=version+1,updated_at=? WHERE organization_id=?`,[fresh.customerId,fresh.subscriptionId,fresh.planKey||row.plan_key,fresh.status,fresh.validUntil,since,fresh.providerUpdatedAt,watermark,operation==='REPLACE'?null:row.last_event_id,needs?1:0,now(),org]);
       outcome=needs?'RECONCILIATION_REQUIRED':operation==='PROVISION'?'PROVISIONED':operation==='REPLACE'?'REPLACED':'RECONCILED';
      }
     }
     const receipt={requestId:input.requestId,operation,source:'PADDLE_GET',outcome,providerUpdatedAt:fresh.providerUpdatedAt,recordedAt:now()},context={organizationId:org,...await subscriptionState(db,c.query,org),seatsUsed:Number((await c.query(`SELECT COUNT(*) AS n FROM ${t('memberships')} WHERE organization_id=?`,[org])).rows[0].n)};
     const result={receipt,context,replayed:false};await c.query(`UPDATE ${t('billing_operations')} SET status='COMPLETE',result_json=?,lease_token=NULL,lease_until=NULL,error_code=NULL,updated_at=? WHERE organization_id=? AND request_id=?`,[JSON.stringify(result),now(),org,input.requestId]);await audit(c,'billing.lookup_completed',input.requestId);return result;
    });
   }catch(caught){
    const error=caught?.code==='23505'||caught?.errcode===2067?new ApiError(409,'BINDING_EXISTS','Subscription binding is already reserved; operator review required'):caught;
    const code=safeCodes.includes(error?.code)?error.code:'BILLING_PROVIDER_UNAVAILABLE';
    try{await tx(user,org,async c=>{const pending=await command(c,input.requestId);if(pending?.status==='RUNNING'&&pending.lease_token===claim.token){await c.query(`UPDATE ${t('billing_operations')} SET status='FAILED',error_code=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE organization_id=? AND request_id=?`,[code,now(),org,input.requestId]);await audit(c,'billing.lookup_failed',input.requestId);}});}catch{}
    if(['ROLE_FORBIDDEN','TENANT_FORBIDDEN'].includes(error?.code))throw new ApiError(403,error.code,'Current company owner access is required');
    const responses={BILLING_PROVIDER_NOT_CONFIGURED:[503,'Provider lookup is not configured'],BILLING_PROVIDER_NOT_FOUND:[404,'Provider subscription was not found'],BILLING_PROVIDER_TIMEOUT:[504,'Provider lookup timed out; retry the same request'],BILLING_PROVIDER_INVALID_RESPONSE:[502,'Provider returned an invalid subscription response'],BILLING_BINDING_MISMATCH:[403,'Provider subscription ownership does not match this company'],VERSION_CONFLICT:[409,'Subscription changed during lookup; retry for a fresh snapshot'],BILLING_LEASE_EXPIRED:[409,'Billing lookup lease expired; retry the same request'],INVALID_BILLING_EVENT:[422,'Provider subscription data could not be validated'],BINDING_EXISTS:[409,'Subscription binding is reserved; operator review required'],BILLING_CURRENT_SUBSCRIPTION_ACTIVE:[409,'The provider must show the previous subscription as canceled before replacement']};
    const [status,message]=responses[code]||[503,'Provider reconciliation could not complete; retry the same request'],safe=new ApiError(status,code,message);
    if(Number.isSafeInteger(error?.retryAfter)&&error.retryAfter>0&&error.retryAfter<=300)safe.retryAfter=error.retryAfter;throw safe;

   }
  }
 };
}
