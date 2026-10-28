import {ApiError} from '../../middleware/errorHandler.js';
export function paddleApiConfigured(){return typeof process.env.PADDLE_API_KEY==='string'&&!!process.env.PADDLE_API_KEY.trim()&&!process.env.PADDLE_API_KEY.startsWith('replace-');}
export async function getPaddleSubscription(subscriptionId,{fetchImpl=fetch,apiKey=process.env.PADDLE_API_KEY,environment=process.env.PADDLE_ENVIRONMENT||'sandbox',timeoutMs=8000}={}){
 if(!/^sub_[a-z\d]{26}$/.test(subscriptionId||''))throw new ApiError(400,'BAD_INPUT','Invalid subscription ID');
 if(!apiKey||apiKey.startsWith('replace-'))throw new ApiError(503,'BILLING_PROVIDER_NOT_CONFIGURED','Provider subscription lookup is not configured');
 if(!['sandbox','production'].includes(environment))throw new ApiError(503,'BILLING_PROVIDER_NOT_CONFIGURED','Provider environment is not configured');
 const origin=environment==='sandbox'?'https://sandbox-api.paddle.com':'https://api.paddle.com';
 try{
  const response=await fetchImpl(`${origin}/subscriptions/${subscriptionId}`,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok){await response.body?.cancel();if(response.status===404)throw new ApiError(404,'BILLING_PROVIDER_NOT_FOUND','Provider subscription was not found');const e=new ApiError(503,'BILLING_PROVIDER_UNAVAILABLE','Provider subscription lookup is unavailable');if(response.status===429)e.retryAfter=30;throw e;}
  const reader=response.body?.getReader();if(!reader)throw new Error('Missing response stream');const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288){await reader.cancel();throw new Error('Response too large');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(body?.data?.id!==subscriptionId)throw new Error('Mismatched subscription');return body.data;
 }catch(e){
  if(e instanceof ApiError)throw e;
  if(['TimeoutError','AbortError'].includes(e?.name))throw new ApiError(504,'BILLING_PROVIDER_TIMEOUT','Provider lookup timed out; retry the same request');
  throw new ApiError(502,'BILLING_PROVIDER_INVALID_RESPONSE','Provider returned an unreadable subscription response');
 }
}
