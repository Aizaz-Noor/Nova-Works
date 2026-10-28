import {createHash} from 'node:crypto';
import {ApiError} from '../middleware/errorHandler.js';
// Call inside the business transaction. Failed mutations roll back their slot.
export async function consumeWriteQuota(db,c,{namespace,limit,windowMs,time=Date.now(),code,message}){
 const table=(db.kind==='postgres'?'novaworks.':'')+'request_limits',bucket=namespace+':'+createHash('sha256').update(JSON.stringify([c.organizationId,c.userId])).digest('hex');
 if(db.kind==='postgres')await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[`write-quota:${bucket}`]);
 const current=(await c.query(`SELECT count,resets_at FROM ${table} WHERE bucket=?`,[bucket])).rows[0],active=current&&Number(current.resets_at)>time;
 if(active&&Number(current.count)>=limit){const error=new ApiError(429,code,message);error.retryAfter=Math.max(1,Math.ceil((Number(current.resets_at)-time)/1000));throw error;}
 await c.query(`INSERT INTO ${table}(bucket,count,resets_at) VALUES(?,?,?) ON CONFLICT(bucket) DO UPDATE SET count=excluded.count,resets_at=excluded.resets_at`,[bucket,active?Number(current.count)+1:1,active?Number(current.resets_at):time+windowMs]);
}
