import {createPlatformService} from '../service.js';
import {createBillingOperations} from './operations.js';
import {billingConfiguration,hasBillingConfiguration,configureBillingEnvironment} from './policy.js';
export function createBillingReconciler(db,{userId,providerOptions={}}={}){
 if(!hasBillingConfiguration(db))configureBillingEnvironment(db);
 if(typeof userId!=='string'||!userId.trim())throw new Error('A scoped billing owner identity is required');
 if(!billingConfiguration(db).enabled)throw new Error('Billing policy must be enabled');
 const platform=createPlatformService(db),operations=createBillingOperations(db,providerOptions);if(!operations.available())throw new Error('Provider lookup must be configured');let stopped=false,inFlight=null;
 async function work(){
  const companies=(await platform.listOrganizations(userId)).filter(c=>c.role==='OWNER'),results=[];
  for(const company of companies){if(stopped)break;try{
   const target=await platform.transaction(userId,company.id,async c=>(await c.query(`SELECT provider_subscription_id,version FROM ${db.kind==='postgres'?'novaworks.':''}platform_subscriptions WHERE organization_id=?`,[company.id])).rows[0]);if(!target?.provider_subscription_id)continue;
   const hour=new Date(billingConfiguration(db).clock()).toISOString().slice(0,13),requestId=`scheduled:${company.id}:${hour}:${target.version}`;
   const result=await operations.execute(userId,company.id,'RECONCILE',{requestId});results.push({outcome:result.receipt.outcome,replayed:result.replayed});
  }catch(e){results.push({code:['BILLING_OPERATION_BUSY','BILLING_LOOKUP_LIMIT','BILLING_RETRY_LIMIT','BILLING_PROVIDER_NOT_CONFIGURED','VERSION_CONFLICT','ROLE_FORBIDDEN','TENANT_FORBIDDEN'].includes(e?.code)?e.code:'BILLING_RECONCILIATION_FAILED'});}}
  return results;
 }
 return {tick(){if(stopped)return Promise.resolve([]);if(!inFlight)inFlight=work().finally(()=>{inFlight=null;});return inFlight;},async stop(){stopped=true;await inFlight?.catch(()=>{});}};
}
export function startBillingReconciler(db,{intervalMs=60000,onResult=()=>{},onError=()=>{},...options}={}){
 if(!Number.isSafeInteger(intervalMs)||intervalMs<10||intervalMs>3600000)throw new Error('Invalid billing poll interval');
 const worker=createBillingReconciler(db,options);let stopped=false,timer;
 async function poll(){try{const result=await worker.tick();if(result.length)onResult(result);}catch{onError('BILLING_POLL_FAILED');}finally{if(!stopped)timer=setTimeout(poll,intervalMs);}}
 void poll();return {async stop(){stopped=true;clearTimeout(timer);await worker.stop();}};
}
