import {createMfaService} from '../backend/src/platform/mfa/service.js';
import {createMfaCipher,totpCode} from '../backend/src/platform/mfa/crypto.js';
import {createRecoveryService} from '../backend/src/platform/recovery.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createSettingsService} from '../backend/src/platform/settings.js';
import {configureBilling} from '../backend/src/platform/billing/policy.js';
// Disposable loopback PostgreSQL only. Never reads hosted DATABASE_URL.
import pg from '../backend/node_modules/pg/lib/index.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {createApp} from '../backend/src/app.js';
import {createBillingService} from '../backend/src/platform/billing/service.js';
import {createCompanyAiWorker} from '../backend/src/modules/companyAi/worker.js';
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_mfah_${suffix}`,role=`nw_mfah_runtime_${suffix}`;
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8')),control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime,server;const evidence={checks:[],result:'FAIL'};
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-subscription-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
const user=await createPlatformService(db).register({name:'MFA HTTP',email:'mfa-http@example.test',password:'mfa-http-test-password'});let clock=Date.now();const options={cipher:createMfaCipher({activeKeyId:'fixture',keys:{fixture:Buffer.alloc(32,53)}}),clock:()=>clock},mfa=createMfaService(db,options),origin='http://127.0.0.1:5173',baseOptions={db,erpEnabled:true,mfaOptions:options,frontendOrigin:origin,sessionSecret:'mfa-http-test-session-secret-only-32',production:false,loginLimit:30};let port;
 async function start(extra={}){server=createApp({...baseOptions,...extra}).listen(port||0,'127.0.0.1');await new Promise(r=>server.once('listening',r));port=server.address().port;}
 await start();function client(){let cookie='';return async(path,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}`+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',Connection:'close'},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};};}const a=client(),b=client(),c=client(),login=(call,password='mfa-http-test-password',mfaCode)=>call('/api/auth/login','POST',{email:user.email,password,...(mfaCode?{mfaCode}:{})});

  assert.equal((await login(a)).status,200);const setup=await mfa.begin(user.id,'mfa-http-test-password'),enabled=await mfa.confirm(user.id,{password:'mfa-http-test-password',pendingId:setup.pendingId,code:totpCode(setup.secret,{timeMs:clock})});assert.equal((await a('/api/auth/me')).status,401);assert.equal((await login(b)).body.error.code,'MFA_REQUIRED');assert.equal((await b('/api/v1/organizations')).status,401);clock+=30000;const code=totpCode(setup.secret,{timeMs:clock});assert.equal((await login(b,undefined,code)).status,200);assert.equal((await b('/api/v1/organizations')).status,200);assert.equal((await login(c,undefined,code)).body.error.code,'MFA_INVALID');
  await new Promise(r=>server.close(r));await start({mfaOptions:{}});assert.equal((await b('/api/auth/me')).status,503);assert.equal((await login(c,undefined,enabled.recoveryCodes[0])).status,503);await new Promise(r=>server.close(r));await start({erpEnabled:false});assert.equal((await login(c)).body.error.code,'MFA_REQUIRED');assert.equal((await login(c,undefined,enabled.recoveryCodes[0])).status,200);await new Promise(r=>server.close(r));await start();
  const messages=[],recovery=createRecoveryService(db,{clock:options.clock,deliver:async m=>messages.push(m)});await recovery.request(user.email);await recovery.reset(messages[0].token,'after-recovery-mfa-password');assert.equal((await b('/api/auth/me')).status,401);assert.equal((await login(a,'after-recovery-mfa-password')).body.error.code,'MFA_REQUIRED');assert.equal((await login(a,'after-recovery-mfa-password',enabled.recoveryCodes[1])).status,200);assert.equal((await mfa.state(user.id)).enabled,true);await mfa.disable(user.id,{password:'after-recovery-mfa-password',code:enabled.recoveryCodes[2]});assert.equal((await a('/api/auth/me')).status,401);assert.equal((await login(a,'after-recovery-mfa-password')).status,200);

 evidence.result='PASS';evidence.checks.push('actual restricted PostgreSQL HTTP MFA login, pending-password denial, replay rejection and factor epoch enforcement','missing keys fail503; legacy mode cannot bypass; password recovery keeps MFA required','backup-code login and disabling with current password/unused backup rotate epoch and invalidate sessions');
}finally{await new Promise(r=>server?server.close(r):r());await runtime?.end();await admin.end();await mkdir('tmp/mfa-http-postgres',{recursive:true});await writeFile('tmp/mfa-http-postgres/results.json',JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));
