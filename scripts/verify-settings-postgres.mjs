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
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_settings_${suffix}`,role=`nw_settings_runtime_${suffix}`;
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8')),control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime,server;const evidence={checks:[],result:'FAIL'};
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-subscription-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 const p=createPlatformService(db),settings=createSettingsService(db),people=[];
 for(const name of ['owner','member','beta'])people.push(await p.register({name,email:`${name}@pg-settings.test`,password:'settings-test-password'}));const [owner,member,beta]=people,a=await p.createOrganization(owner.id,{name:'Alpha'}),b=await p.createOrganization(beta.id,{name:'Beta'}),invite=await p.invite(owner.id,a.id,{email:member.email,role:'MEMBER'});await p.acceptInvitation(member.id,a.id,invite.token);
 const input={version:0,legalName:'Alpha Legal',defaultCurrency:'PKR',locale:'en-PK',timezone:'Asia/Karachi'};
 await assert.rejects(settings.update(member.id,a.id,input),e=>e.code==='ROLE_FORBIDDEN');await assert.rejects(settings.get(beta.id,a.id),e=>e.code==='TENANT_FORBIDDEN');
 const results=await Promise.allSettled([settings.update(owner.id,a.id,input),settings.update(owner.id,a.id,{...input,legalName:'Concurrent'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'VERSION_CONFLICT');assert.equal((await settings.get(member.id,a.id)).defaultCurrency,'PKR');assert.equal((await settings.get(beta.id,b.id)).version,0);
 assert.equal((await db.query('SELECT * FROM novaworks.platform_organization_settings')).rows.length,0);await assert.rejects(db.query('DELETE FROM novaworks.platform_organization_settings'),e=>e.code==='42501');
 evidence.result='PASS';evidence.checks.push('013 migration and restricted runtime provisioning','actual PostgreSQL concurrent initial settings admits one version and rejects stale writer409','member update and cross-company access denied; member can read own settings','no-context RLS returns zero and runtime DELETE denied42501');
}catch(e){evidence.error=e.message;throw e;}finally{await runtime?.end();await admin.end();await mkdir('tmp/settings-postgres',{recursive:true});await writeFile('tmp/settings-postgres/results.json',JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));
