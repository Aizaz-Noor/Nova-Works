import {hasBillingConfiguration,configureBillingEnvironment} from '../../platform/billing/policy.js';
import {createPlatformService} from '../../platform/service.js';
import {createCompanyAiService} from './service.js';

// This worker uses the same restricted runtime connection and current company
// memberships as the API. No tenant-policy bypass or privileged discovery query.
export function createCompanyAiWorker(db,{userId,serviceOptions={},batchSize=5}={}){
 if(!hasBillingConfiguration(db))configureBillingEnvironment(db);
 if(typeof userId!=='string'||!userId.trim())throw new Error('A configured worker identity is required');
 if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>50)throw new Error('Invalid worker batch size');
 const platform=createPlatformService(db),service=createCompanyAiService(db,serviceOptions);
 let inFlight=null,stopped=false;
 async function work(){
  const organizations=(await platform.listOrganizations(userId)).filter(o=>['OWNER','ADMIN'].includes(o.role));
  const outcomes=[];
  for(const company of organizations){
   if(stopped)break;
   let pending;
   try{pending=await service.pending(userId,company.id,batchSize);}catch(e){outcomes.push({code:safeCode(e)});continue;}
   for(const job of pending){
    if(stopped)break;
    try{const result=await service.run(userId,company.id,job.id,{automatic:true});outcomes.push({id:job.id,status:result.status});}
    catch(e){outcomes.push({id:job.id,code:safeCode(e)});if(e.code==='AI_QUOTA')break;}
   }
  }
  return outcomes;
 }
 return {
  tick(){if(stopped)return Promise.resolve([]);if(inFlight)return inFlight;inFlight=work().finally(()=>{inFlight=null;});return inFlight;},
  async stop(){stopped=true;await inFlight?.catch(()=>{});}
 };
}
function safeCode(error){return ['SUBSCRIPTION_READ_ONLY','PLAN_FEATURE','AI_BUSY','AI_QUOTA','AI_LEASE_EXPIRED','AI_DISCARDED','ROLE_FORBIDDEN','TENANT_FORBIDDEN'].includes(error?.code)?error.code:'WORKER_OPERATION_FAILED';}

export function startCompanyAiWorker(db,{intervalMs=5000,onResult=()=>{},onError=()=>{},...options}={}){
 if(!Number.isSafeInteger(intervalMs)||intervalMs<10||intervalMs>60000)throw new Error('Invalid worker poll interval');
 const worker=createCompanyAiWorker(db,options);let timer,stopped=false;
 async function loop(){try{const results=await worker.tick();if(results.length)onResult(results);}catch{onError('WORKER_POLL_FAILED');}finally{if(!stopped)timer=setTimeout(loop,intervalMs);}}
 void loop();
 return {async stop(){stopped=true;clearTimeout(timer);await worker.stop();}};
}
