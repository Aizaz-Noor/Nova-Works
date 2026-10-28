import {createPlatformService} from './service.js';
export function createRecoveryRetention(db,{clock=()=>Date.now()}={}){
 const platform=createPlatformService(db),table=`${db.kind==='postgres'?'novaworks.':''}account_recovery_tokens`;
 return {async run({mode='PREVIEW',retentionDays=7,batchSize=100}={}){
  if(!['PREVIEW','APPLY'].includes(mode)||!Number.isSafeInteger(retentionDays)||retentionDays<7||retentionDays>365||!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>1000)throw new Error('Supported mode,7-365days and1-1000batch required');
  const cutoff=new Date(clock()-retentionDays*86400000).toISOString();
  return platform.transaction('recovery-retention-operator',null,async c=>{
   if(db.kind==='postgres')await c.query("SELECT set_config('app.recovery_retention_cutoff',?,true)",[cutoff]);
   const eligible=Number((await c.query(`SELECT COUNT(*) AS n FROM (SELECT token_hash FROM ${table} WHERE expires_at<=? ORDER BY expires_at,token_hash LIMIT ?) eligible`,[cutoff,batchSize])).rows[0].n);
   let deleted=0;if(mode==='APPLY'){
    if(db.kind==='postgres')await c.query("SELECT pg_advisory_xact_lock(hashtext('recovery-retention'))");
    if(db.kind==='postgres')deleted=Number((await c.query(`WITH eligible AS (SELECT token_hash FROM ${table} WHERE expires_at<=? ORDER BY expires_at,token_hash LIMIT ?),removed AS (DELETE FROM ${table} r USING eligible e WHERE r.token_hash=e.token_hash AND r.expires_at<=? RETURNING 1) SELECT COUNT(*) AS n FROM removed`,[cutoff,batchSize,cutoff])).rows[0].n);
    else deleted=(await c.query(`DELETE FROM ${table} WHERE expires_at<=? AND token_hash IN (SELECT token_hash FROM ${table} WHERE expires_at<=? ORDER BY expires_at,token_hash LIMIT ?)`,[cutoff,cutoff,batchSize])).changes;
   }
   return {mode,retentionDays,cutoff,batchSize,eligibleInBatch:eligible,deleted};
  });
 }};
}
