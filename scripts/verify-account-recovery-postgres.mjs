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
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_recovery_http_${suffix}`,role=`nw_recovery_http_runtime_${suffix}`;
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8')),control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime,server;const evidence={checks:[],result:'FAIL'};
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-subscription-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
const messages=[],origin='http://127.0.0.1:5173';const app=createApp({db,erpEnabled:true,recoveryOptions:{deliver:async message=>messages.push(message)},frontendOrigin:origin,sessionSecret:'account-recovery-local-test-secret-only',production:false});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 function client(){let cookie='';return async(path,method='GET',body,trusted=true)=>{const r=await fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...(trusted?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,body:await r.json()};};}
 const a=client(),b=client(),email='recover-http@example.test',password='original-http-password',newPassword='recovered-http-password',request='/api/v1/account/recovery/request',reset='/api/v1/account/recovery/reset';

  assert.equal((await a('/api/v1/register','POST',{name:'Recovery User',email,password})).status,201);assert.equal((await b('/api/auth/login','POST',{email,password})).status,200);
  assert.equal((await a(request,'POST',{email},false)).status,403);const known=await a(request,'POST',{email}),unknown=await a(request,'POST',{email:'unknown@example.test'});assert.deepEqual(known,unknown);assert.equal(known.status,202);assert.deepEqual(known.body,{accepted:true});assert.equal(messages.length,1);
  const token=messages[0].token,replies=await Promise.all([a(reset,'POST',{token,newPassword}),b(reset,'POST',{token,newPassword})]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);assert.equal((await a('/api/auth/me')).status,401);assert.equal((await b('/api/auth/me')).status,401);assert.equal((await a('/api/auth/login','POST',{email,password})).status,401);assert.equal((await a('/api/auth/login','POST',{email,password:newPassword})).status,200);
  assert.equal((await a(reset,'POST',{token,newPassword})).status,400);await a(request,'POST',{email});await a(request,'POST',{email});assert.equal((await a(request,'POST',{email})).status,429);for(let n=0;n<2;n++)await a(request,'POST',{email:'unknown@example.test'});assert.equal((await a(request,'POST',{email:'unknown@example.test'})).status,429);

 assert.equal((await db.query('SELECT * FROM novaworks.account_recovery_tokens')).rows.length,0);await assert.rejects(db.query('DELETE FROM novaworks.account_recovery_tokens'),e=>e.code==='42501');evidence.result='PASS';evidence.checks.push('actual restricted PostgreSQL recovery request/reset HTTP, single-use concurrent reset, revoked old sessions and new-password login','known/unknown accepted responses and atomic identity request limits match','recovery ledger hidden without user/token context; runtime DELETE denied42501');
}finally{await new Promise(r=>server?server.close(r):r());await runtime?.end();await admin.end();await mkdir('tmp/recovery-postgres',{recursive:true});await writeFile('tmp/recovery-postgres/results.json',JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));
