import {createMfaService} from '../backend/src/platform/mfa/service.js';
import {createMfaCipher,totpCode} from '../backend/src/platform/mfa/crypto.js';
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
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_mfa_${suffix}`,role=`nw_mfa_runtime_${suffix}`;
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8')),control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime,server;const evidence={checks:[],result:'FAIL'};
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-subscription-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 const platform=createPlatformService(db),user=await platform.register({name:'MFA PG Fixture',email:'mfa-pg@example.test',password:'mfa-pg-test-password'}),other=await platform.register({name:'Other MFA User',email:'other-mfa@example.test',password:'other-mfa-test-password'});let clock=Date.now();const cipher=createMfaCipher({activeKeyId:'fixture',keys:{fixture:Buffer.alloc(32,41)}}),options={cipher,clock:()=>clock},first=createMfaService(db,options),second=createMfaService(db,options),setup=await first.begin(user.id,'mfa-pg-test-password'),enabled=await first.confirm(user.id,{password:'mfa-pg-test-password',pendingId:setup.pendingId,code:totpCode(setup.secret,{timeMs:clock})});
 assert.equal(JSON.stringify((await admin.query('SELECT * FROM novaworks.account_mfa_factors')).rows).includes(setup.secret),false);assert.equal(JSON.stringify((await admin.query('SELECT * FROM novaworks.account_mfa_recovery_codes')).rows).includes(enabled.recoveryCodes[0]),false);clock+=30000;const code=totpCode(setup.secret,{timeMs:clock}),replies=await Promise.allSettled([first.prove(user.id,code),second.prove(user.id,code)]);assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.equal(replies.find(r=>r.status==='rejected').reason.code,'MFA_INVALID');
 const backups=await Promise.allSettled([first.prove(user.id,enabled.recoveryCodes[0]),second.prove(user.id,enabled.recoveryCodes[0])]);assert.equal(backups.filter(r=>r.status==='fulfilled').length,1);assert.equal(backups.find(r=>r.status==='rejected').reason.code,'MFA_INVALID');
 for(const table of ['account_mfa_factors','account_mfa_recovery_codes']){assert.equal((await db.query(`SELECT * FROM novaworks.${table}`)).rows.length,0);assert.equal((await platform.transaction(other.id,null,c=>c.query(`SELECT * FROM novaworks.${table}`))).rows.length,0);await assert.rejects(db.query(`DELETE FROM novaworks.${table}`),e=>e.code==='42501');}
 const denied=await platform.transaction(other.id,null,c=>c.query('UPDATE novaworks.account_mfa_factors SET epoch=? WHERE user_id=?',['forged',user.id]));assert.equal(denied.rowCount,0);assert.equal((await first.state(user.id)).epoch,enabled.epoch);const disabled=await first.disable(user.id,{password:'mfa-pg-test-password',code:enabled.recoveryCodes[1]});assert.equal(disabled.enabled,false);assert.notEqual(disabled.epoch,enabled.epoch);
 evidence.result='PASS';evidence.checks.push('016 restricted runtime and forced self RLS; no-context/other-user factor and code reads empty; foreign update0; DELETE42501','encrypted factor secret and hashed backup codes exclude raw proof values','two independent service instances accept one concurrent TOTP and one concurrent backup redemption','current-password plus unused backup disables factor and rotates epoch');
}finally{await runtime?.end();await admin.end();await mkdir('tmp/mfa-postgres',{recursive:true});await writeFile('tmp/mfa-postgres/results.json',JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));
