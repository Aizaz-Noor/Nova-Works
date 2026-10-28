import {createBillingOperations} from './operations.js';
import {createHash,randomUUID} from 'node:crypto';
import {createPlatformService} from '../service.js';
import {billingConfiguration,subscriptionState} from './policy.js';
import {ApiError} from '../../middleware/errorHandler.js';
export function createBillingService(db,providerOptions={}){
 const platform=createPlatformService(db),t=name=>`${db.kind==='postgres'?'novaworks.':''}platform_${name}`;
 const operations=createBillingOperations(db,providerOptions);
 const now=()=>new Date(billingConfiguration(db).clock()).toISOString();
 const audit=(c,action,id)=>c.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[c.organizationId,randomUUID(),c.userId,action,id,now()]);
 return {
  operate:operations.execute,
  context(user,org){return platform.transaction(user,org,async c=>({organizationId:org,...await subscriptionState(db,c.query,org),providerLookupAvailable:operations.available(),seatsUsed:Number((await c.query(`SELECT COUNT(*) AS n FROM ${t('memberships')} WHERE organization_id=?`,[org])).rows[0].n)}));},
  details(user,org){return platform.transaction(user,org,async c=>{if(!['OWNER','ADMIN'].includes(c.member.role))throw new ApiError(403,'ROLE_FORBIDDEN','Billing details require company administration');const binding=(await c.query(`SELECT provider_subscription_id FROM ${t('subscriptions')} WHERE organization_id=?`,[org])).rows[0];return {organizationId:org,providerLookupAvailable:operations.available(),binding:{configured:!!binding?.provider_subscription_id,subscriptionId:binding?.provider_subscription_id||null},operations:(await c.query(`SELECT request_id,operation,status,attempts,error_code,updated_at,result_json FROM ${t('billing_operations')} WHERE organization_id=? ORDER BY updated_at DESC,request_id DESC LIMIT 20`,[org])).rows.map(row=>{const {result_json,...safe}=row;return {...safe,receipt:result_json?JSON.parse(result_json).receipt:null};}),subscription:await subscriptionState(db,c.query,org),events:(await c.query(`SELECT event_id,event_type,occurred_at,outcome,received_at FROM ${t('billing_events')} WHERE organization_id=? ORDER BY received_at DESC,event_id DESC LIMIT 30`,[org])).rows};});},
  // Operator/server integration only. There is deliberately no customer HTTP route
  // that sets plan/status or binds arbitrary provider IDs.
  bind(user,org,{customerId,subscriptionId}){return platform.transaction(user,org,async c=>{
   if(!billingConfiguration(db).policy?.testOnly)throw new ApiError(403,'VERIFIED_PROVISIONING_REQUIRED','Use provider-verified provisioning for non-test subscriptions');
   if(c.member.role!=='OWNER')throw new ApiError(403,'ROLE_FORBIDDEN','Only a verified owner binding may be provisioned');
   if(!/^ctm_[a-z\d]{26}$/.test(customerId||'')||!/^sub_[a-z\d]{26}$/.test(subscriptionId||''))throw new ApiError(400,'BAD_INPUT','Invalid provider binding IDs');
   const row=(await c.query(`SELECT * FROM ${t('subscriptions')} WHERE organization_id=?`,[org])).rows[0];if(!row)throw new ApiError(409,'BILLING_NOT_ENROLLED','Company has no provisioned subscription');
   if(row.provider_subscription_id&&row.provider_subscription_id!==subscriptionId||row.provider_customer_id&&row.provider_customer_id!==customerId)throw new ApiError(409,'BINDING_EXISTS','Subscription replacement needs operator reconciliation');
   await c.query(`UPDATE ${t('subscriptions')} SET provider_customer_id=?,provider_subscription_id=?,updated_at=? WHERE organization_id=?`,[customerId,subscriptionId,now(),org]);await audit(c,'billing.binding_provisioned',subscriptionId);return {bound:true};
  });},
  apply(event){
   if(!billingConfiguration(db).enabled)throw new ApiError(503,'BILLING_DISABLED','Subscription enforcement is disabled');
   // Reached only after signature verification. The signed org hint is a selector,
   // never proof: the existing server-provisioned customer/subscription pair must match.
   return platform.transaction('billing-provider',event.organizationId,async c=>{
    const row=(await c.query(`SELECT * FROM ${t('subscriptions')} WHERE organization_id=?`,[event.organizationId])).rows[0];
    if(!row||row.provider_customer_id!==event.customerId||row.provider_subscription_id!==event.subscriptionId)throw new ApiError(403,'BILLING_BINDING_MISMATCH','Event does not match the provisioned company subscription');
    const {organizationId,eventId,eventType,occurredAt,customerId,subscriptionId,planKey,status,validUntil}=event;
    // Preserve 011 receipt fingerprints when adding provider revision metadata.
    const hash=createHash('sha256').update(JSON.stringify({organizationId,eventId,eventType,occurredAt,customerId,subscriptionId,planKey,status,validUntil})).digest('hex'),old=(await c.query(`SELECT event_hash,outcome FROM ${t('billing_events')} WHERE organization_id=? AND event_id=?`,[event.organizationId,event.eventId])).rows[0];
    if(old){if(old.event_hash!==hash)throw new ApiError(409,'BILLING_EVENT_CONFLICT','Event identity was reused with different subscription data');return {received:true,replayed:true,applied:false,outcome:old.outcome};}
    let outcome='APPLIED';
    if(row.last_event_at&&event.occurredAt<row.last_event_at)outcome='IGNORED_OLDER';
    else if(row.provider_updated_at&&event.providerUpdatedAt&&event.providerUpdatedAt<row.provider_updated_at)outcome='IGNORED_OLDER_PROVIDER_REVISION';
    else if(row.provider_updated_at&&(!event.providerUpdatedAt||event.providerUpdatedAt===row.provider_updated_at&&(row.needs_reconciliation||row.status!==event.status||row.plan_key!==event.planKey||row.valid_until!==event.validUntil))){
     outcome='RECONCILIATION_REQUIRED';await c.query(`UPDATE ${t('subscriptions')} SET needs_reconciliation=1,last_event_at=?,last_event_id=?,version=version+1,updated_at=? WHERE organization_id=?`,[event.occurredAt,event.eventId,now(),event.organizationId]);
    }
    else if(row.last_event_at===event.occurredAt){
     const same=row.status===event.status&&row.plan_key===event.planKey&&row.valid_until===event.validUntil;outcome=same?'IGNORED_EQUAL':'RECONCILIATION_REQUIRED';
     if(!same)await c.query(`UPDATE ${t('subscriptions')} SET needs_reconciliation=1,version=version+1,updated_at=? WHERE organization_id=?`,[now(),event.organizationId]);
    }else{
     const needs=!event.planKey||['ACTIVE','TRIAL'].includes(event.status)&&!event.validUntil;
     outcome=needs?'RECONCILIATION_REQUIRED':'APPLIED';
     const since=event.status==='PAST_DUE'?(row.status==='PAST_DUE'&&row.past_due_since?row.past_due_since:event.occurredAt):null;
     await c.query(`UPDATE ${t('subscriptions')} SET plan_key=?,status=?,valid_until=?,past_due_since=?,provider_updated_at=?,last_event_at=?,last_event_id=?,needs_reconciliation=?,version=version+1,updated_at=? WHERE organization_id=?`,[event.planKey||row.plan_key,event.status,event.validUntil,since,event.providerUpdatedAt||row.provider_updated_at||null,event.occurredAt,event.eventId,needs?1:0,now(),event.organizationId]);
    }
    await c.query(`INSERT INTO ${t('billing_events')}(organization_id,event_id,event_hash,occurred_at,event_type,outcome,received_at) VALUES(?,?,?,?,?,?,?)`,[event.organizationId,event.eventId,hash,event.occurredAt,event.eventType,outcome,now()]);await audit(c,'billing.event_received',event.eventId);
    return {received:true,replayed:false,applied:outcome==='APPLIED',outcome};
   },{bootstrap:true});
  }
 };
}
