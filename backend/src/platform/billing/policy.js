import {readFileSync} from 'node:fs';
import {ApiError} from '../../middleware/errorHandler.js';
const configurations=new WeakMap();
const features=['crm','projects','sales','timesheets','invoicing','ai','reports'];
const fail=(code,message)=>{throw new ApiError(402,code,message);};
export function configureBilling(db,{enabled=false,policy,clock=()=>Date.now()}={}){
 if(enabled){
  if(!policy||!Number.isSafeInteger(policy.trialDays)||policy.trialDays<1||policy.trialDays>90||!Number.isSafeInteger(policy.graceDays)||policy.graceDays<0||policy.graceDays>30||typeof policy.initialPlan!=='string'||!policy.plans||typeof policy.plans!=='object'||Array.isArray(policy.plans)||!Object.hasOwn(policy.plans,policy.initialPlan))throw new Error('Explicit billing policy required');
  if(!policy.pricePlans||typeof policy.pricePlans!=='object'||Array.isArray(policy.pricePlans)||Object.entries(policy.pricePlans).some(([price,key])=>!/^pri_[a-z\d]{26}$/.test(price)||typeof key!=='string'||!Object.hasOwn(policy.plans,key)))throw new Error('Invalid billing price mapping');
  for(const [key,plan]of Object.entries(policy.plans)){
   if(!/^[A-Z][A-Z0-9_]{0,39}$/.test(key)||!Number.isSafeInteger(plan.seats)||plan.seats<1||plan.seats>10000||!Number.isSafeInteger(plan.aiDaily)||plan.aiDaily<0||plan.aiDaily>1000||features.some(f=>typeof plan.features?.[f]!=='boolean'))throw new Error('Invalid billing plan policy');
  }
 }
 const previous=configurations.get(db);if(previous){if(previous.enabled!==enabled||enabled&&JSON.stringify(previous.policy)!==JSON.stringify(policy))throw new Error('Billing database configuration cannot change while live');return;}
 configurations.set(db,{enabled,policy:enabled?structuredClone(policy):null,clock});
}
export function configureBillingEnvironment(db){
 if(process.env.BILLING_ENABLED!=='1'){configureBilling(db);return;}
 const path=process.env.BILLING_POLICY_FILE;if(!path)throw new Error('BILLING_POLICY_FILE required');
 const policy=JSON.parse(readFileSync(path,'utf8'));if(process.env.NODE_ENV==='production'&&policy.testOnly)throw new Error('Test billing policy cannot activate production');configureBilling(db,{enabled:true,policy});
}
export const hasBillingConfiguration=db=>configurations.has(db);
export const billingConfiguration=db=>configurations.get(db)||{enabled:false,clock:()=>Date.now()};
export async function subscriptionState(db,query,org){
 const config=billingConfiguration(db);
 const table=`${db.kind==='postgres'?'novaworks.':''}platform_subscriptions`;
 if(!config.enabled){
  // A process missing its billing policy must not treat an enrolled customer as
  // an unlimited development company, particularly in a standalone worker.
  if(configurations.has(db)&&(await query(`SELECT organization_id FROM ${table} WHERE organization_id=?`,[org])).rows.length)return {enabled:true,policyMode:'CONFIGURATION_REQUIRED',status:'CONFIGURATION_REQUIRED',access:'READ_ONLY',planKey:null,features:{},limits:null};
  return {enabled:false,policyMode:'DISABLED',status:'DEVELOPMENT',access:'WRITE',planKey:null,features:Object.fromEntries(features.map(f=>[f,true])),limits:null};
 }
 const row=(await query(`SELECT * FROM ${table} WHERE organization_id=?`,[org])).rows[0];
 if(!row)return {enabled:true,policyMode:config.policy.testOnly?'TEST_ONLY':'CONFIGURED',status:'UNCONFIGURED',access:'READ_ONLY',planKey:null,features:{},limits:null};
 const now=config.clock(),plan=Object.hasOwn(config.policy.plans,row.plan_key)?config.policy.plans[row.plan_key]:null;let status=row.status,write=false,graceUntil=null;
 if(row.needs_reconciliation||!plan)status='RECONCILIATION_REQUIRED';
 else if(status==='ACTIVE'||status==='TRIAL'){write=!!row.valid_until&&Date.parse(row.valid_until)>now;if(!write)status='EXPIRED';}
 else if(status==='PAST_DUE'){graceUntil=row.past_due_since?new Date(Date.parse(row.past_due_since)+config.policy.graceDays*86400000).toISOString():null;write=!!graceUntil&&Date.parse(graceUntil)>now;if(write)status='GRACE';}
 return {enabled:true,policyMode:config.policy.testOnly?'TEST_ONLY':'CONFIGURED',status,access:write?'WRITE':'READ_ONLY',planKey:row.plan_key,validUntil:row.valid_until,graceUntil,version:row.version,features:plan?.features||{},limits:plan?{seats:plan.seats,aiDaily:plan.aiDaily}:null};
}
export async function requireBillingFeature(db,c,feature,{write=false}={}){
 const state=await subscriptionState(db,c.query,c.organizationId);
 if(write&&state.access!=='WRITE')fail('SUBSCRIPTION_READ_ONLY','The company subscription is read-only. Saved data and permitted exports remain available.');
 if(state.enabled&&!state.features[feature])fail('PLAN_FEATURE','This feature is not included in the configured company plan');
 return state;
}
export async function initializeCompanyTrial(db,c){
 const config=billingConfiguration(db);if(!config.enabled)return;
 const stamp=new Date(config.clock()).toISOString(),until=new Date(config.clock()+config.policy.trialDays*86400000).toISOString();
 await c.query(`INSERT INTO ${db.kind==='postgres'?'novaworks.':''}platform_subscriptions(organization_id,plan_key,status,valid_until,created_at,updated_at) VALUES(?,?,'TRIAL',?,?,?)`,[c.organizationId,config.policy.initialPlan,until,stamp,stamp]);
}
const tableFeatures={customers:'crm',contacts:'crm',activities:'crm',project_customers:'crm',leads:'crm',deals:'crm',deal_projects:'crm',projects:'projects',tasks:'projects',time_billing_roots:'invoicing',time_allocations:'invoicing',billing_rates:'invoicing',task_attachments:'projects',task_comments:'projects',milestones:'projects',quotes:'sales',quote_items:'sales',sales_orders:'sales',sales_order_items:'sales',time_entries:'timesheets',time_approvals:'timesheets',client_invoices:'invoicing',invoice_items:'invoicing',payment_records:'invoicing',credit_notes:'invoicing',invoice_counters:'invoicing',ai_jobs:'ai',ai_usage:'ai'};
export async function guardCompanyMutation(db,c,sql,values){
 if(!billingConfiguration(db).enabled&&!configurations.has(db))return;
 const match=/^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:novaworks\.)?platform_(\w+)/i.exec(sql);if(!match)return;
 const name=match[1];if(name==='memberships'&&c.memberMaintenance&&/^\s*UPDATE\s+(?:novaworks\.)?platform_memberships\s+SET\s+role=\?,status=\?,version=version\+1,updated_at=\?\s+WHERE/i.test(sql))return;if(name==='notifications'&&/^\s*UPDATE\s+(?:novaworks\.)?platform_notifications\s+SET\s+read_at=COALESCE\(read_at,\?\)\s+WHERE/i.test(sql))return;if(['subscriptions','billing_events','billing_operations'].includes(name)||name==='audit'&&/^\s*INSERT/i.test(sql)||name==='ai_jobs'&&c.billingMaintenance)return;
 const state=c.billingDecision||(c.billingDecision=await subscriptionState(db,c.uncheckedQuery,c.organizationId));
 if(state.access!=='WRITE')fail('SUBSCRIPTION_READ_ONLY','The company subscription is read-only. Saved data and permitted exports remain available.');
 if(tableFeatures[name]&&!state.features[tableFeatures[name]])fail('PLAN_FEATURE','This feature is not included in the configured company plan');
 if(name==='memberships'&&state.enabled&&state.limits&&/^\s*INSERT/i.test(sql)){
  const used=Number((await c.uncheckedQuery(`SELECT COUNT(*) AS n FROM ${db.kind==='postgres'?'novaworks.':''}platform_memberships WHERE organization_id=?`,[c.organizationId])).rows[0].n);
  if(used>=state.limits.seats)fail('SEAT_LIMIT','The configured company seat limit has been reached');
 }
}
