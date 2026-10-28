import {createRecoveryRetention} from '../backend/src/platform/recoveryRetention.js';
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
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_retention_${suffix}`,role=`nw_retention_runtime_${suffix}`;
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8')),control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime,server,operator;const evidence={checks:[],result:'FAIL'};
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-subscription-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 const p=createPlatformService(db),user=await p.register({name:'Retention PG',email:'retention-pg@example.test',password:'retention-pg-password'});let clock=Date.now()-8*86400000;const messages=[],recovery=createRecoveryService(db,{clock:()=>clock,deliver:async message=>messages.push(message)});
 for(let i=0;i<3;i++)await recovery.request(user.email);clock=Date.now();await recovery.request(user.email);
 const operatorRole=`nw_retention_operator_${suffix}`,operatorPassword=`fixture-operator-${suffix}`;let sql=await readFile('backend/scripts/provision-recovery-retention.sql','utf8');sql=sql.replace(/^\\.*$/gm,'').replace(/:'retention_role'/g,`'${operatorRole}'`);await admin.query(sql);await admin.query(sql);await admin.query(`ALTER ROLE ${operatorRole} PASSWORD '${operatorPassword}'`);operator=new pg.Pool({...config,database,user:operatorRole,password:operatorPassword});const operatorDb=adapter(operator),retention=createRecoveryRetention(operatorDb);
 assert.equal((await operatorDb.query('SELECT * FROM novaworks.account_recovery_tokens')).rows.length,0);await assert.rejects(operatorDb.query('SELECT * FROM novaworks.users'),e=>e.code==='42501');assert.equal((await retention.run()).eligibleInBatch,3);assert.equal((await admin.query('SELECT COUNT(*) n FROM novaworks.account_recovery_tokens')).rows[0].n,'4');
 assert.equal((await retention.run({mode:'APPLY',batchSize:2})).deleted,2);assert.equal((await retention.run({mode:'APPLY',batchSize:2})).deleted,1);assert.equal((await retention.run({mode:'APPLY'})).deleted,0);assert.equal((await admin.query('SELECT COUNT(*) n FROM novaworks.account_recovery_tokens')).rows[0].n,'1');await operatorDb.transaction(async c=>{await c.query("SELECT set_config('app.recovery_retention_cutoff','2099-12-31T00:00:00.000Z',true)");assert.equal((await c.query('DELETE FROM novaworks.account_recovery_tokens')).rowCount,0);});await assert.rejects(operatorDb.query("UPDATE novaworks.account_recovery_tokens SET expires_at='2000-01-01T00:00:00.000Z'"),e=>e.code==='42501');assert.deepEqual(await recovery.reset(messages.at(-1).token,'after-pg-retention-password'),{success:true,signInRequired:true});
 await assert.rejects(db.query('DELETE FROM novaworks.account_recovery_tokens'),e=>e.code==='42501');await assert.rejects(admin.query(sql.replaceAll(operatorRole,role)),e=>e.code==='P0001'&&/separate role|rewrite tokens/.test(e.message));evidence.result='PASS';evidence.checks.push('dedicated NOSUPERUSER NOBYPASSRLS operator provisioning repeat PASS; application role reuse rejected','no-context ledger invisible; operator users read denied42501; application DELETE remains denied42501','preview preserves4 rows; APPLY batches delete2+1+0; recent token remains valid and resets password');
}finally{await operator?.end();await runtime?.end();await admin.end();await mkdir('tmp/retention-postgres',{recursive:true});await writeFile('tmp/retention-postgres/results.json',JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));
