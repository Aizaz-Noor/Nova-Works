import {createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError} from '../../middleware/errorHandler.js';
const bad=(code,message,status=400)=>{throw new ApiError(status,code,message);};
export function verifyPaddleSignature(raw,header,secret,{clock=()=>Date.now()}={}){
 if(typeof secret!=='string'||secret.length<32)bad('BILLING_WEBHOOK_DISABLED','Billing webhook is not configured',503);
 if(!Buffer.isBuffer(raw)||typeof header!=='string'||header.length>2048)bad('INVALID_SIGNATURE','Invalid webhook signature',401);
 const parts=header.split(';').map(v=>v.trim().split('=')),timestamps=parts.filter(([key])=>key==='ts'),signatures=parts.filter(([key])=>key==='h1').map(([,value])=>value);
 if(timestamps.length!==1||!/^\d{10,13}$/.test(timestamps[0][1])||!signatures.length||signatures.some(v=>!/^[a-f\d]{64}$/i.test(v)))bad('INVALID_SIGNATURE','Invalid webhook signature',401);
 const stamp=timestamps[0][1];if(Math.abs(clock()/1000-Number(stamp))>5)bad('INVALID_SIGNATURE','Webhook signature timestamp is outside tolerance',401);
 const expected=createHmac('sha256',secret).update(stamp+':').update(raw).digest();
 if(!signatures.some(value=>timingSafeEqual(expected,Buffer.from(value,'hex'))))bad('INVALID_SIGNATURE','Invalid webhook signature',401);
}
const id=(value,prefix)=>typeof value==='string'&&new RegExp(`^${prefix}_[a-z\\d]{26}$`).test(value);
export function normalizePaddleEvent(body,policy,{clock=()=>Date.now()}={}){
 const allowed=['subscription.created','subscription.updated','subscription.activated','subscription.canceled','subscription.past_due','subscription.paused','subscription.resumed','subscription.trialing'];
 if(!body||typeof body!=='object'||!allowed.includes(body.event_type))bad('UNSUPPORTED_BILLING_EVENT','Unsupported subscription event',422);
 const stamp=new Date(body.occurred_at);if(!id(body.event_id,'evt')||typeof body.occurred_at!=='string'||!Number.isFinite(stamp.getTime())||stamp.getTime()>clock()+60000)bad('INVALID_BILLING_EVENT','Invalid billing event identity or timestamp',422);
 const normalized=normalizePaddleSubscription(body.data,policy,{clock});
 return {organizationId:normalized.organizationId,eventId:body.event_id,eventType:body.event_type,occurredAt:stamp.toISOString(),customerId:normalized.customerId,subscriptionId:normalized.subscriptionId,planKey:normalized.planKey,status:normalized.status,validUntil:normalized.validUntil,providerUpdatedAt:normalized.providerUpdatedAt};
}
export function normalizePaddleSubscription(data,policy,{clock=()=>Date.now()}={}){
 const org=data?.custom_data?.novaworks_organization_id;
 if(typeof org!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(org)||!id(data?.id,'sub')||!id(data?.customer_id,'ctm'))bad('INVALID_BILLING_EVENT','Event must identify an existing company subscription binding',422);
 const statuses={trialing:'TRIAL',active:'ACTIVE',past_due:'PAST_DUE',canceled:'CANCELED',paused:'PAUSED'};
 if(!Object.hasOwn(statuses,data.status))bad('INVALID_BILLING_EVENT','Unknown subscription state',422);
 const priceId=Array.isArray(data.items)&&data.items.length===1&&data.items[0].quantity===1?data.items[0].price?.id:null;
 const planKey=priceId&&Object.hasOwn(policy.pricePlans||{},priceId)?policy.pricePlans[priceId]:null;
 const end=data.current_billing_period?.ends_at||data.next_billed_at;
 let validUntil=end&&Number.isFinite(Date.parse(end))?new Date(end).toISOString():null;
 const scheduled=data.scheduled_change;if(['cancel','pause'].includes(scheduled?.action)&&Number.isFinite(Date.parse(scheduled.effective_at))){const stop=new Date(scheduled.effective_at).toISOString();if(!validUntil||stop<validUntil)validUntil=stop;}
 const providerUpdatedAt=typeof data.updated_at==='string'&&Number.isFinite(Date.parse(data.updated_at))?new Date(data.updated_at).toISOString():null;
 if(providerUpdatedAt&&Date.parse(providerUpdatedAt)>clock()+60000)bad('INVALID_BILLING_EVENT','Provider revision is in the future',422);
 return {organizationId:org,customerId:data.customer_id,subscriptionId:data.id,planKey:policy.plans[planKey]?planKey:null,status:statuses[data.status],validUntil,providerUpdatedAt};
}
