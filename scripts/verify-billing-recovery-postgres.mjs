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
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_recovery_${suffix}`,role=`nw_recovery_runtime_${suffix}`;
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8')),control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime,server;const evidence={checks:[],result:'FAIL'};
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-subscription-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 let clock=Date.now(),raw,duringRead,calls=0;
 const id=(prefix,char)=>`${prefix}_${char.repeat(26)}`,origin='http://127.0.0.1:3038',secret='local-postgres-signature-test-only-at-least-32';
 const getSubscription=async target=>{calls++;if(duringRead)await duringRead();return structuredClone(raw[target]);};
 const appOptions={db,erpEnabled:true,billingOptions:{enabled:true,policy,clock:()=>clock},billingProvider:{getSubscription},paddleWebhookSecret:secret,sessionSecret:'local-postgres-billing-session-at-least-32',frontendOrigin:origin,production:false};
 server=createApp(appOptions).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const port=server.address().port,base=`http://127.0.0.1:${port}`;
 function client(){let cookie='';return async(path,method='GET',body)=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',Connection:'close'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};};}
 const a=client(),b=client(),other=client(),people=[];
 for(const [call,name]of[[a,'owner'],[b,'beta'],[other,'admin']]){const person=await call('/register','POST',{name,email:`${name}@pg-recovery.test`,password:'local-billing-test-password'});assert.equal(person.status,201);people.push(person.body);}
 const alpha=await a('/organizations','POST',{name:'Alpha Recovery'}),beta=await b('/organizations','POST',{name:'Beta Recovery'});await a('/organizations/select','POST',{organizationId:alpha.body.id});await b('/organizations/select','POST',{organizationId:beta.body.id});
 const invitation=await a('/invitations','POST',{email:people[2].email,role:'ADMIN'});assert.equal((await other('/invitations/accept','POST',{organizationId:alpha.body.id,token:invitation.body.token})).status,200);await other('/organizations/select','POST',{organizationId:alpha.body.id});
 const data=(char='a',status='active')=>({id:id('sub',char),customer_id:id('ctm','a'),status,updated_at:new Date(clock).toISOString(),custom_data:{novaworks_organization_id:alpha.body.id},items:[{quantity:1,price:{id:id('pri','b')}}],current_billing_period:{ends_at:'2099-12-31T00:00:00.000Z'}});
 raw={[id('sub','a')]:data()};const command={requestId:'verified',subscriptionId:id('sub','a')};
 assert.equal((await other('/billing/provision','POST',command)).status,403);assert.equal(calls,0);
 assert.equal((await b('/billing/provision','POST',command)).status,403);
 const linked=await a('/billing/provision','POST',command);assert.equal(linked.status,200,JSON.stringify(linked.body));assert.equal(linked.body.context.status,'ACTIVE');
 const count=calls;assert.equal((await a('/billing/provision','POST',command)).body.replayed,true);assert.equal(calls,count);
 assert.equal((await a('/projects','POST',{name:'Preserved recovery work'})).status,201);
 clock+=1000;const canceled=data('a','canceled');let eventNumber=0;
 async function webhook(entity){const body={event_id:`evt_${String(++eventNumber).padStart(26,'0')}`,event_type:'subscription.updated',occurred_at:new Date(clock).toISOString(),data:entity},text=JSON.stringify(body),ts=Math.floor(clock/1000),signature=createHmac('sha256',secret).update(`${ts}:`).update(text).digest('hex');const r=await fetch(base+'/api/billing/paddle-webhook',{method:'POST',headers:{'Content-Type':'application/json','Paddle-Signature':`ts=${ts};h1=${signature}`,Connection:'close'},body:text});assert.equal(r.status,200,await r.text());}
 duringRead=()=>webhook(canceled);const raced=await a('/billing/reconcile','POST',{requestId:'race'});assert.equal(raced.status,409,JSON.stringify(raced.body));duringRead=null;raw[id('sub','a')]=canceled;
 assert.equal((await a('/billing/reconcile','POST',{requestId:'race'})).body.context.status,'CANCELED');assert.equal((await a('/projects','POST',{name:'Blocked'})).status,402);
 clock+=1000;raw[id('sub','a')]=data();raw[id('sub','b')]=data('b');const replacement={requestId:'replace',subscriptionId:id('sub','b'),currentSubscriptionId:id('sub','a')};assert.equal((await a('/billing/replace','POST',replacement)).status,409);
 raw[id('sub','a')]=data('a','canceled');const replaced=await a('/billing/replace','POST',replacement);assert.equal(replaced.status,200,JSON.stringify(replaced.body));assert.equal(replaced.body.context.status,'ACTIVE');assert.equal((await a('/projects')).body.length,1);
 assert.equal((await db.query('SELECT * FROM novaworks.platform_billing_operations')).rows.length,0);await assert.rejects(db.query('DELETE FROM novaworks.platform_billing_operations'),e=>e.code==='42501');
 const forced=await admin.query("SELECT relforcerowsecurity FROM pg_class WHERE oid='novaworks.platform_billing_operations'::regclass");assert.equal(forced.rows[0].relforcerowsecurity,true);
 await new Promise(r=>server.close(r));server=createApp(appOptions).listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));assert.equal((await a('/billing/replace','POST',replacement)).body.replayed,true);assert.equal((await a('/projects')).body.length,1);
 evidence.checks.push('012 migration and provisioned restricted runtime PASS','Owner-only HTTP provider verification and foreign-company denial PASS','durable replay performs no GET and survives server restart PASS','signed webhook completes during GET; stale operation fails409 and retry preserves cancellation PASS','read-only recovery and canceled-old verified replacement preserve business data PASS','forced tenant RLS hides operations without context; runtime DELETE denied42501 PASS');evidence.result='PASS';
}catch(e){evidence.error=e.message;throw e;}finally{await new Promise(r=>server?server.close(r):r());await runtime?.end();await admin.end();await mkdir('tmp/billing-recovery-postgres',{recursive:true});await writeFile('tmp/billing-recovery-postgres/results.json',JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));
