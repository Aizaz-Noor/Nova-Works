// Disposable loopback PostgreSQL proof. Never reads hosted DATABASE_URL.
import pg from '../backend/node_modules/pg/lib/index.js';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {migrations,migratePlatform} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createTaskService} from '../backend/src/modules/projects/taskService.js';
import {createCrmService} from '../backend/src/modules/crm/service.js';
import {createSalesService} from '../backend/src/modules/sales/service.js';
import {createInvoiceService} from '../backend/src/modules/invoicing/service.js';
import {createTimesheetService} from '../backend/src/modules/timesheets/service.js';
import {createCommentService} from '../backend/src/modules/projects/commentService.js';

const portable='E:/Projects/Hackathon/tmp/novaworks-analysis-20261019/tmp';
const password=(await readFile(`${portable}/pg-portable/password.txt`,'utf8')).trim();
const config={host:'127.0.0.1',port:5432,user:'nw_test_admin',password,ssl:false,connectionTimeoutMillis:5000};
const stamp=Date.now(),database=`nw_cas_${stamp}`,restored=`nw_cas_restore_${stamp}`,role=`nw_cas_rt_${stamp}`;
const output=resolve(`tmp/cas-postgres-${stamp}`);await mkdir(output,{recursive:true});
const adapter=(pool,beforeQuery=async()=>{})=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const connection={query:async(sql,args)=>{await beforeQuery(sql);return c.query(sql,args);}};const result=await work(connection);await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}});
const control=new pg.Client({...config,database:'postgres'});await control.connect();
let admin,runtime,restoredAdmin,restoredRuntime;const evidence={result:'FAIL',database,restored,checks:[]};
const check=(name)=>evidence.checks.push(name);
async function snapshot(pool,{normalizeVersions=false}={}){
 const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='novaworks' ORDER BY tablename")).rows;
 const result={};for(const {tablename}of tables){
  const rows=(await pool.query(`SELECT to_jsonb(t) row FROM novaworks."${tablename.replaceAll('"','""')}" t`)).rows.map(x=>x.row).filter(row=>tablename!=='platform_migrations'||!row.version.startsWith('025_'));
  if(normalizeVersions&&['platform_projects','platform_tasks'].includes(tablename))for(const row of rows)delete row.version;
  const lines=rows.map(row=>JSON.stringify(row)).sort();result[tablename]={count:lines.length,sha256:createHash('sha256').update(lines.join('\n')).digest('hex')};
 }return result;
}
async function richFixture(db){
 const p=createPlatformService(db),t=createTaskService(db),s=createSalesService(db),i=createInvoiceService(db),time=createTimesheetService(db);
 const owner=await p.register({name:'Historical engagement owner',email:'rich-owner@pg-cas.test',password:'IsolatedPostgresCAS2026!'}),member=await p.register({name:'Historical worker',email:'rich-worker@pg-cas.test',password:'IsolatedPostgresCAS2026!'}),org=await p.createOrganization(owner.id,{name:'Historical engagement'}),u=owner.id,o=org.id;
 const invite=await p.invite(u,o,{email:member.email,role:'MEMBER'});await p.acceptInvitation(member.id,o,invite.token);
 const customer=await createCrmService(db).create(u,o,{name:'Historical fictional customer'});
 let quote=await s.create(u,o,{customerId:customer.id,title:'Historical agreement',currency:'PKR',items:[{description:'Fictional delivery',quantity:1,unitMinor:'10000',taxRateBps:0}]});
 quote=await s.issue(u,o,quote.id,{version:quote.version});quote=await s.decide(u,o,quote.id,{version:quote.version,approvalReference:'Fictional acceptance'},true);const {order}=await s.convert(u,o,quote.id,{version:quote.version});
 const project=await p.createProject(u,o,{name:'Historical delivery'}),task=await t.create(u,o,{projectId:project.id,title:'Historical assignment',description:'Fictional work',assigneeId:member.id,deadline:'2099-12-01',estimatedHours:2});
 let entry=(await time.create(member.id,o,{requestId:'historic-time',projectId:project.id,taskId:task.id,workDate:'2026-01-10',minutes:90,billable:false,description:'Fixed-price effort'})).entry;
 entry=await time.submit(member.id,o,entry.id,{version:entry.version});await time.review(u,o,entry.id,{version:entry.version,decision:'APPROVE',note:'Fictional independent review'});
 const comment=await createCommentService(db).create(member.id,o,task.id,{body:'Historical collaboration evidence',requestId:randomUUID()});
 let invoice=(await i.create(u,o,{salesOrderId:order.id})).invoice;invoice=await i.issue(u,o,invoice.id,{version:invoice.version});await i.pay(u,o,invoice.id,{version:invoice.version,requestId:'historic-receipt',currency:'PKR',amountMinor:'2500',paidOn:'2026-01-10',reference:'Fictional receipt'});
 return {owner:u,member:member.id,organization:o,project:project.id,task:task.id,customer:customer.id,order:order.id,invoice:invoice.id,time:entry.id,comment:comment.id};
}
try{
 await control.query(`CREATE DATABASE ${database}`);admin=new pg.Pool({...config,database});
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));
 await admin.query('CREATE TABLE novaworks.platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');
 const prior=migrations.filter(x=>!x.version.startsWith('025_'));
 assert.equal(prior.at(-1).version,'024_member_lifecycle');
 for(const m of prior){await admin.query(m.postgresSql);await admin.query('INSERT INTO novaworks.platform_migrations VALUES($1,$2,$3)',[m.version,createHash('sha256').update(m.postgresSql).digest('hex'),new Date().toISOString()]);}
 await admin.query("BEGIN; SELECT set_config('app.organization_id','historical-company',true),set_config('app.user_id','historical-owner',true); INSERT INTO novaworks.users VALUES('historical-owner','Historical owner','history@cas.test','fixture','AGENT','','[]');INSERT INTO novaworks.platform_organizations VALUES('historical-company','Historical company','historical-owner','old-created');INSERT INTO novaworks.platform_memberships(organization_id,user_id,role,created_at) VALUES('historical-company','historical-owner','OWNER','old-created');INSERT INTO novaworks.platform_projects(organization_id,id,name,manager_id,created_at) VALUES('historical-company','historical-project','Historical project','historical-owner','old-created');INSERT INTO novaworks.platform_tasks(organization_id,id,project_id,title,description,assignee_id,deadline,estimated_hours,created_at) VALUES('historical-company','historical-task','historical-project','Historical task','Preserved scope','historical-owner','2099-12-01',2,'old-created'); COMMIT");
 const history=(await admin.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 let provision=(await readFile('backend/scripts/provision-runtime.sql','utf8')).replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);
 await admin.query(provision);const runtimePassword=randomUUID();await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);
 runtime=new pg.Pool({...config,database,user:role,password:runtimePassword,max:4});
 await assert.rejects(assertPlatformRuntimeRole(adapter(runtime)),/version|column/i);check('unmigrated restricted runtime refused for missing version columns');
 const rich=await richFixture(adapter(runtime));const allBefore=await snapshot(admin,{normalizeVersions:true});
 const beforeProjects=(await admin.query('SELECT * FROM novaworks.platform_projects')).rows;
 const beforeTasks=(await admin.query('SELECT * FROM novaworks.platform_tasks')).rows;
 await migratePlatform(adapter(admin));await migratePlatform(adapter(admin));
 const strip=rows=>rows.map(({version,...row})=>row);
 const afterProjects=(await admin.query('SELECT * FROM novaworks.platform_projects')).rows;
 const afterTasks=(await admin.query('SELECT * FROM novaworks.platform_tasks')).rows;
 assert.deepEqual(strip(afterProjects),beforeProjects);assert.deepEqual(strip(afterTasks),beforeTasks);
 assert.equal(afterProjects[0].version,1);assert.equal(afterTasks[0].version,1);
 assert.deepEqual(await snapshot(admin,{normalizeVersions:true}),allBefore);check('all table digests preserved across populated upgrade, normalizing only added project/task versions and new migration row');
 assert.deepEqual((await admin.query("SELECT version,checksum FROM novaworks.platform_migrations WHERE version NOT LIKE '025_%' ORDER BY version")).rows,history);check('populated 024 upgrade preserves project/task fields, links and prior checksums; repeat no-op');
 await assertPlatformRuntimeRole(adapter(runtime));check('restricted upgraded runtime accepted');
 const p=createPlatformService(adapter(runtime)),t=createTaskService(adapter(runtime));
 const owner=await p.register({name:'Fictional CAS owner',email:'owner@pg-cas.test',password:'IsolatedPostgresCAS2026!'}),org=await p.createOrganization(owner.id,{name:'Fictional CAS company'});
 let project=await p.createProject(owner.id,org.id,{name:'Concurrent project'});
 let task=await t.create(owner.id,org.id,{projectId:project.id,title:'Concurrent task',description:'Fictional work',assigneeId:owner.id,deadline:'2099-12-01',estimatedHours:1});
 assert.equal(project.version,1);assert.equal(task.version,1);
 // Independent pools guarantee separate PostgreSQL connections for competing writers.
 const second=new pg.Pool({...config,database,user:role,password:runtimePassword,max:1});
 try{
  for(const [name,firstService,secondService,record,bodyA,bodyB,action] of [
   ['project',p,createPlatformService(adapter(second)),project,{name:'Winner A'},{status:'ACTIVE'},'project.updated'],
   ['task',t,createTaskService(adapter(second)),task,{title:'Winner A'},{status:'IN_PROGRESS'},'task.updated']]){
   let arrivals=0,release;const gate=new Promise(resolve=>{release=resolve;});
   const beforeQuery=async sql=>{if(/^UPDATE novaworks\.platform_(projects|tasks) SET/.test(sql)){arrivals++;if(arrivals===2)release();await Promise.race([gate,new Promise((_,reject)=>{const timeout=setTimeout(()=>reject(new Error('Two-writer barrier timed out')),5000);gate.finally(()=>clearTimeout(timeout));})]);}};
   const left=name==='project'?createPlatformService(adapter(runtime,beforeQuery)):createTaskService(adapter(runtime,beforeQuery));
   const right=name==='project'?createPlatformService(adapter(second,beforeQuery)):createTaskService(adapter(second,beforeQuery));
   const call=(service,body)=>name==='project'?service.updateProject(owner.id,org.id,record.id,{version:record.version,...body}):service.update(owner.id,org.id,record.id,{version:record.version,...body});
   const outcomes=await Promise.allSettled([call(left,bodyA),call(right,bodyB)]);assert.equal(arrivals,2,'Both writers must reach UPDATE after their reads');
   assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
   assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'VERSION_CONFLICT');
   const rows=(await admin.query(`SELECT version FROM novaworks.platform_${name==='project'?'projects':'tasks'} WHERE id=$1`,[record.id])).rows;assert.equal(rows[0].version,2);
   assert.equal(Number((await admin.query('SELECT COUNT(*) n FROM novaworks.platform_audit WHERE entity_id=$1 AND action=$2',[record.id,action])).rows[0].n),1);
   check(`${name} two-connection race: one commit, one conflict, one revision/audit`);
  }
 }finally{await second.end();}
 const dump=resolve(output,'fixture.dump'),tools=`${portable}/pg-client-tools/pgsql/bin`;
 const beforeRestore=await snapshot(admin);
 execFileSync(`${tools}/pg_dump.exe`,['-h','127.0.0.1','-p',String(config.port),'-U',config.user,'-Fc','-f',dump,database],{env:{...process.env,PGPASSWORD:password},stdio:'pipe'});
 await control.query(`CREATE DATABASE ${restored}`);
 execFileSync(`${tools}/pg_restore.exe`,['-h','127.0.0.1','-p',String(config.port),'-U',config.user,'--no-owner','--no-acl','-d',restored,dump],{env:{...process.env,PGPASSWORD:password},stdio:'pipe'});
 restoredAdmin=new pg.Pool({...config,database:restored});await restoredAdmin.query(provision);
 restoredRuntime=new pg.Pool({...config,database:restored,user:role,password:runtimePassword});
 await assert.rejects(assertPlatformRuntimeRole(adapter(restoredRuntime)),/Unsafe company member lifecycle/);
 await restoredAdmin.query(await readFile('backend/scripts/restore-member-lifecycle-owners.sql','utf8'));
 await assertPlatformRuntimeRole(adapter(restoredRuntime));
 assert.deepEqual(await snapshot(restoredAdmin),beforeRestore);
 const richInvoice=await createInvoiceService(adapter(restoredRuntime)).invoice(rich.owner,rich.organization,rich.invoice);assert.equal(richInvoice.balanceMinor,'7500');assert.equal(richInvoice.sales_order_id,rich.order);
 assert.equal((await createTimesheetService(adapter(restoredRuntime)).entry(rich.member,rich.organization,rich.time)).status,'APPROVED');
 assert.equal((await createCommentService(adapter(restoredRuntime)).list(rich.member,rich.organization,rich.task)).comments[0].id,rich.comment);
 check('restored all table digests and historical customer/order/invoice balance, approved time and task/comment ownership links');
 const restoredP=createPlatformService(adapter(restoredRuntime));project=(await restoredP.listProjects(owner.id,org.id)).find(x=>x.id===project.id);assert.equal(project.version,2);
 await restoredP.updateProject(owner.id,org.id,project.id,{version:2,status:'DONE'});
 await assert.rejects(restoredP.updateProject(owner.id,org.id,project.id,{version:2,name:'Stale after restore'}),e=>e.code==='VERSION_CONFLICT');
 const restoredT=createTaskService(adapter(restoredRuntime));
 await restoredT.update(owner.id,org.id,task.id,{version:2,status:'DONE'});
 await assert.rejects(restoredT.update(owner.id,org.id,task.id,{version:2,status:'TODO'}),e=>e.code==='VERSION_CONFLICT');
 const outsider=await restoredP.register({name:'Fictional outsider',email:'outsider@pg-cas.test',password:'IsolatedPostgresCAS2026!'}),other=await restoredP.createOrganization(outsider.id,{name:'Separate fictional company'});
 await assert.rejects(restoredP.updateProject(outsider.id,other.id,project.id,{version:3,status:'ACTIVE'}),e=>e.code==='NOT_FOUND');
 await assert.rejects(restoredT.update(outsider.id,other.id,task.id,{version:3,status:'TODO'}),e=>e.code==='NOT_FOUND');
 check('actual custom-format dump/restore: unsafe stripped function ownership refused, trusted owners restored; project/task valid/stale updates and foreign-company denials');
 evidence.result='PASS';console.log(JSON.stringify(evidence,null,2));
}finally{
 await Promise.allSettled([runtime?.end(),restoredRuntime?.end(),admin?.end(),restoredAdmin?.end()]);
 await writeFile(resolve(output,'evidence.json'),JSON.stringify(evidence,null,2));await control.end();
 // Keep only these named disposable databases for inspection; no remote deletion.
}
