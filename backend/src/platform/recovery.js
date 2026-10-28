import {recordAccountSecurity} from './accountSecurity.js';
import {randomBytes,createHash} from 'node:crypto';
import {createPlatformService} from './service.js';
import {hashPassword,credentialStamp} from '../services/passwords.js';
import {ApiError} from '../middleware/errorHandler.js';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function recoverySql(prefix=''){return `CREATE TABLE ${prefix}account_recovery_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES ${prefix}users(id),credential_stamp TEXT NOT NULL,expires_at TEXT NOT NULL,consumed_at TEXT,created_at TEXT NOT NULL);CREATE INDEX account_recovery_user ON ${prefix}account_recovery_tokens(user_id,created_at);`;}
export function recoveryRlsSql(){const scope="user_id=NULLIF(current_setting('app.user_id',true),'') OR token_hash=NULLIF(current_setting('app.recovery_token_hash',true),'')";return `ALTER TABLE novaworks.account_recovery_tokens ENABLE ROW LEVEL SECURITY;ALTER TABLE novaworks.account_recovery_tokens FORCE ROW LEVEL SECURITY;CREATE POLICY recovery_select ON novaworks.account_recovery_tokens FOR SELECT USING(${scope});CREATE POLICY recovery_insert ON novaworks.account_recovery_tokens FOR INSERT WITH CHECK(user_id=NULLIF(current_setting('app.user_id',true),''));CREATE POLICY recovery_update ON novaworks.account_recovery_tokens FOR UPDATE USING(${scope}) WITH CHECK(${scope});REVOKE ALL ON novaworks.account_recovery_tokens FROM PUBLIC;`;}
export function createRecoveryService(db,{deliver,clock=()=>Date.now()}={}){
 const platform=createPlatformService(db),prefix=db.kind==='postgres'?'novaworks.':'',tokens=`${prefix}account_recovery_tokens`,users=`${prefix}users`,accepted={accepted:true},invalid=()=>{throw new ApiError(400,'INVALID_RECOVERY','Recovery link is invalid or expired. Request a new link.');};
 const tx=(identity,tokenHash,work)=>platform.transaction(identity,null,async c=>{if(db.kind==='postgres')await c.query("SELECT set_config('app.recovery_token_hash',?,true)",[tokenHash||'']);return work(c);});
 return {available:()=>typeof deliver==='function',async request(email){
  if(typeof deliver!=='function')throw new ApiError(503,'RECOVERY_NOT_CONFIGURED','Account recovery delivery is not configured');
  if(typeof email!=='string'||email.length>254||!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw new ApiError(400,'BAD_INPUT','Provide a valid email');
  const address=email.trim().toLowerCase(),token=randomBytes(32).toString('base64url'),tokenHash=digest(token),stamp=new Date(clock()).toISOString(),expiresAt=new Date(clock()+30*60000).toISOString();
  const user=await tx('account-recovery','',async c=>(await c.query(`SELECT id,email,password_hash FROM ${users} WHERE email=?`,[address])).rows[0]);
  if(!user||address.endsWith('@novaworks.example'))return {...accepted};
  await tx(user.id,'',c=>c.query(`INSERT INTO ${tokens}(token_hash,user_id,credential_stamp,expires_at,created_at) VALUES(?,?,?,?,?)`,[tokenHash,user.id,credentialStamp(user.password_hash),expiresAt,stamp]));
  // Raw token exists only in the delivery call, never the ledger or public result.
  const controller=new AbortController();let timeout;try{await Promise.race([Promise.resolve().then(()=>deliver({email:user.email,token,expiresAt,signal:controller.signal})),new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('Delivery deadline'));},5000);})]);}catch{await tx(user.id,tokenHash,c=>c.query(`UPDATE ${tokens} SET consumed_at=? WHERE token_hash=?`,[new Date(clock()).toISOString(),tokenHash]));}finally{clearTimeout(timeout);}
  return {...accepted};
 },async reset(token,password){
  if(typeof token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(token))invalid();
  if(typeof password!=='string'||password.length<12||password.length>128)throw new ApiError(400,'BAD_INPUT','New password must contain 12 to 128 characters');
  const tokenHash=digest(token),next=hashPassword(password);
  return tx('account-recovery',tokenHash,async c=>{
   const row=(await c.query(`SELECT * FROM ${tokens} WHERE token_hash=?${db.kind==='postgres'?' FOR UPDATE':''}`,[tokenHash])).rows[0],stamp=new Date(clock()).toISOString();if(!row||row.consumed_at||row.expires_at<=stamp)invalid();
   const user=(await c.query(`SELECT password_hash FROM ${users} WHERE id=?${db.kind==='postgres'?' FOR UPDATE':''}`,[row.user_id])).rows[0];if(!user||credentialStamp(user.password_hash)!==row.credential_stamp)invalid();
   await c.query(`UPDATE ${users} SET password_hash=? WHERE id=? AND password_hash=?`,[next,row.user_id,user.password_hash]);await c.query(`UPDATE ${tokens} SET consumed_at=? WHERE token_hash=?`,[stamp,tokenHash]);if(db.kind==='postgres')await c.query("SELECT set_config('app.user_id',?,true)",[row.user_id]);await recordAccountSecurity(db,c,row.user_id,'RECOVERY_RESET',stamp);return {success:true,signInRequired:true};
  });
 }};
}
