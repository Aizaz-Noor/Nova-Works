import {Router} from 'express';
import {createHash} from 'node:crypto';
import {ApiError} from '../middleware/errorHandler.js';
import {createRecoveryService} from './recovery.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function recoveryLimit(db,kind){return async(req,res,next)=>{try{
 const time=Date.now(),reset=time+900000,identity=kind==='request'?req.body?.email:req.body?.token,buckets=[[`recovery:${kind}:ip:${hash(req.ip||'unknown')}`,kind==='request'?20:10],...(typeof identity==='string'?[[`recovery:${kind}:identity:${hash(identity.trim().toLowerCase().slice(0,254))}`,kind==='request'?3:5]]:[])];
 for(const [bucket,cap] of buckets){let accepted;if(db.kind==='postgres')accepted=(await db.query(`INSERT INTO novaworks.request_limits(bucket,count,resets_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN novaworks.request_limits.resets_at<=$3 THEN 1 ELSE novaworks.request_limits.count+1 END,resets_at=CASE WHEN novaworks.request_limits.resets_at<=$3 THEN excluded.resets_at ELSE novaworks.request_limits.resets_at END WHERE novaworks.request_limits.resets_at<=$3 OR novaworks.request_limits.count<$4 RETURNING count`,[bucket,reset,time,cap])).rows.length;else accepted=db.prepare(`INSERT INTO request_limits(bucket,count,resets_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN request_limits.resets_at<=? THEN 1 ELSE request_limits.count+1 END,resets_at=CASE WHEN request_limits.resets_at<=? THEN excluded.resets_at ELSE request_limits.resets_at END WHERE request_limits.resets_at<=? OR request_limits.count<? RETURNING count`).get(bucket,reset,time,time,time,cap);if(!accepted){const e=new ApiError(429,'RATE_LIMITED','Too many recovery attempts. Try again in 15 minutes.');e.retryAfter=900;throw e;}}
 next();
 }catch(e){next(e);}};}
export function recoveryRoutes(db,options,cookieOptions){const router=Router(),service=createRecoveryService(db,options);
 const shape=(body,keys)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'BAD_INPUT','Use supported recovery fields');};
 router.post('/account/recovery/request',recoveryLimit(db,'request'),async(req,res)=>{shape(req.body,['email']);const start=performance.now();let result;try{result=await service.request(req.body.email);}finally{const wait=300-(performance.now()-start);if(wait>0)await new Promise(r=>setTimeout(r,wait));}res.status(202).json(result);});
 router.post('/account/recovery/reset',recoveryLimit(db,'reset'),async(req,res)=>{shape(req.body,['token','newPassword']);const result=await service.reset(req.body.token,req.body.newPassword);await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));res.clearCookie('novaworks.sid',cookieOptions);res.json(result);});
 return router;
}
