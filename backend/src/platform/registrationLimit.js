import { createHash } from 'node:crypto';
import { ApiError } from '../middleware/errorHandler.js';

export function registrationLimit(db) {
 return async(req,res,next)=>{
  try{
   const time=Date.now(),reset=time+3600000;
   const bucket=`signup:${createHash('sha256').update(req.ip||'unknown').digest('hex')}`;
   let accepted;
   if(db.kind==='postgres')accepted=(await db.query(`INSERT INTO novaworks.request_limits(bucket,count,resets_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN novaworks.request_limits.resets_at<=$3 THEN 1 ELSE novaworks.request_limits.count+1 END,resets_at=CASE WHEN novaworks.request_limits.resets_at<=$3 THEN excluded.resets_at ELSE novaworks.request_limits.resets_at END WHERE novaworks.request_limits.resets_at<=$3 OR novaworks.request_limits.count<10 RETURNING count`,[bucket,reset,time])).rows.length;
   else accepted=db.prepare(`INSERT INTO request_limits(bucket,count,resets_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN request_limits.resets_at<=? THEN 1 ELSE request_limits.count+1 END,resets_at=CASE WHEN request_limits.resets_at<=? THEN excluded.resets_at ELSE request_limits.resets_at END WHERE request_limits.resets_at<=? OR request_limits.count<10 RETURNING count`).get(bucket,reset,time,time,time);
   if(!accepted){const error=new ApiError(429,'RATE_LIMITED','Account creation limit reached. Try again in one hour.');error.retryAfter=3600;throw error;}
   next();
  }catch(error){next(error);}
 };
}
