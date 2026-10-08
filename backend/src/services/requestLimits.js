import {createPostgresLimits} from './postgresRequestLimits.js';
﻿import { ApiError } from '../middleware/errorHandler.js';
export function createRequestLimits(db, { loginLimit = 10, aiDailyLimit = 20, now = Date.now } = {}) {
 if(db.kind==='postgres')return createPostgresLimits(db,{loginLimit,aiDailyLimit,now});
 if (!Number.isSafeInteger(loginLimit) || loginLimit < 1 || !Number.isSafeInteger(aiDailyLimit) || aiDailyLimit < 1) throw new Error('Request limits must be positive integers');
 db.exec('CREATE TABLE IF NOT EXISTS request_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL)');
 const consumeAtomic=db.prepare(`INSERT INTO request_limits(bucket,count,resets_at) VALUES(?,1,?)
  ON CONFLICT(bucket) DO UPDATE SET
  count=CASE WHEN request_limits.resets_at<=? THEN 1 ELSE request_limits.count+1 END,
  resets_at=CASE WHEN request_limits.resets_at<=? THEN excluded.resets_at ELSE request_limits.resets_at END
  WHERE request_limits.resets_at<=? OR request_limits.count<? RETURNING count`);
 const read=db.prepare('SELECT count,resets_at FROM request_limits WHERE bucket=?');
 const remove=db.prepare('DELETE FROM request_limits WHERE bucket=?');
 const clean=db.prepare('DELETE FROM request_limits WHERE resets_at<=?');
 function consume(bucket,limit,resetsAt,message){
  const time=now();clean.run(time);
  if(!consumeAtomic.get(bucket,resetsAt,time,time,time,limit)){const previous=read.get(bucket);const error=new ApiError(429,'RATE_LIMITED',message);error.retryAfter=Math.max(1,Math.ceil(((previous?.resets_at||resetsAt)-time)/1000));throw error;}
 }
 return {
  login(req,res,next){try{consume(`login:${req.ip}`,loginLimit,now()+15*60*1000,'Too many sign-in attempts. Please wait 15 minutes and try again.');next();}catch(error){next(error);}},
  loginSucceeded(req){remove.run(`login:${req.ip}`);},
  ai(){const time=now();const day=new Date(time).toISOString().slice(0,10);consume(`ai:${day}`,aiDailyLimit,Date.parse(`${day}T00:00:00Z`)+24*60*60*1000,'The demo has reached its daily AI request limit. Existing projects remain available; try again after midnight UTC.');}
 };
}
