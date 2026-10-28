import {createPostgresLimits} from './postgresRequestLimits.js';
import {ApiError} from '../middleware/errorHandler.js';
import {createHash} from 'node:crypto';
export function loginBuckets(req) {
 const identity=req.user?.email||req.body?.email;
 const email=typeof identity==='string'?identity.trim().toLowerCase().slice(0,254):'';
 return [`login:ip:${req.ip}`, ...(email?[`login:account:${createHash('sha256').update(email).digest('hex')}`]:[])];
}
export function loginError(resetsAt,time) {
 const error=new ApiError(429,'RATE_LIMITED','Too many sign-in attempts. Please wait 15 minutes and try again.');
 error.retryAfter=Math.max(1,Math.ceil((resetsAt-time)/1000));return error;
}
export function ensureSqliteRequestLimits(db){if(db.kind!=='postgres')db.exec('CREATE TABLE IF NOT EXISTS request_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL)');}
export function createRequestLimits(db,{loginLimit=10,aiDailyLimit=20,now=Date.now}={}) {
 if(db.kind==='postgres')return createPostgresLimits(db,{loginLimit,aiDailyLimit,now});
 if(!Number.isSafeInteger(loginLimit)||loginLimit<1||!Number.isSafeInteger(aiDailyLimit)||aiDailyLimit<1)throw new Error('Request limits must be positive integers');
 ensureSqliteRequestLimits(db);
 const consumeAtomic=db.prepare(`INSERT INTO request_limits(bucket,count,resets_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN request_limits.resets_at<=? THEN 1 ELSE request_limits.count+1 END,resets_at=CASE WHEN request_limits.resets_at<=? THEN excluded.resets_at ELSE request_limits.resets_at END WHERE request_limits.resets_at<=? OR request_limits.count<? RETURNING count`);
 const read=db.prepare('SELECT count,resets_at FROM request_limits WHERE bucket=?');
 const clean=db.prepare('DELETE FROM request_limits WHERE resets_at<=?');
 const failure=db.prepare(`INSERT INTO request_limits(bucket,count,resets_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN request_limits.resets_at<=? THEN 1 ELSE request_limits.count+1 END,resets_at=CASE WHEN request_limits.resets_at<=? THEN excluded.resets_at ELSE request_limits.resets_at END`);
 return {
  login(req,res,next){try{const time=now();for(const bucket of loginBuckets(req)){const stored=read.get(bucket);if(stored?.resets_at>time&&stored.count>=loginLimit)throw loginError(stored.resets_at,time);}next();}catch(error){next(error);}},
  loginFailed(req){const time=now();clean.run(time);db.exec('BEGIN IMMEDIATE');try{for(const bucket of loginBuckets(req))failure.run(bucket,time+15*60*1000,time,time);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}},
  loginSucceeded(){},
  ai(){const time=now();clean.run(time);const day=new Date(time).toISOString().slice(0,10);const resetsAt=Date.parse(`${day}T00:00:00Z`)+24*60*60*1000;if(!consumeAtomic.get(`ai:${day}`,resetsAt,time,time,time,aiDailyLimit)){const error=new ApiError(429,'RATE_LIMITED','The demo has reached its daily AI request limit. Existing projects remain available; try again after midnight UTC.');error.retryAfter=Math.max(1,Math.ceil((resetsAt-time)/1000));throw error;}}
 };
}
