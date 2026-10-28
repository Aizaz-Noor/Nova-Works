import pg from '../backend/node_modules/pg/lib/index.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {migrations,migratePlatform} from '../backend/src/platform/migrations.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createCrmService} from '../backend/src/modules/crm/service.js';
import {createTaskService} from '../backend/src/modules/projects/taskService.js';
import {createSalesService} from '../backend/src/modules/sales/service.js';
import {createPipelineService} from '../backend/src/modules/pipeline/service.js';
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim();
const config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false};
const stamp=Date.now(),database=`nw_time_upgrade_${stamp}`,role=`nw_time_migrator_${stamp}`;
const control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const connection=new pg.Client({...config,database});await connection.connect();
const db={kind:'postgres',query:(text,args)=>connection.query(text,args),transaction:async work=>{await connection.query('BEGIN');try{const result=await work(connection);await connection.query('COMMIT');return result;}catch(error){await connection.query('ROLLBACK');throw error;}}};
const tables=['platform_projects','platform_tasks','platform_quotes','platform_quote_items','platform_sales_orders','platform_sales_order_items','users','platform_organizations','platform_memberships','platform_customers','platform_deals','platform_pipeline_stages','platform_audit'];
async function snapshot(){return Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await connection.query(`SELECT * FROM novaworks.${table} ORDER BY 1,2`)).rows])));}
try{
 await connection.query(await readFile('backend/migrations/001_postgres.sql','utf8'));
 const pending=migrations.splice(5);try{await migratePlatform(db);}finally{migrations.push(...pending);}
 const platform=createPlatformService(db),crm=createCrmService(db),pipeline=createPipelineService(db);
 const owner=await platform.register({name:'Existing Owner',email:'sales-upgrade@example.test',password:'upgrade-test-password'}),organization=await platform.createOrganization(owner.id,{name:'Existing Company'}),customer=await crm.create(owner.id,organization.id,{name:'Existing Customer'});await pipeline.createDeal(owner.id,organization.id,{customerId:customer.id,name:'Existing Deal',amountMinor:'12345'});

 const project=await platform.createProject(owner.id,organization.id,{name:'Existing delivery',deadline:'2099-12-31'});await createTaskService(db).create(owner.id,organization.id,{projectId:project.id,title:'Existing assigned task',description:'Existing work',assigneeId:owner.id,deadline:'2099-12-01',estimatedHours:8});
 const sales=createSalesService(db),quote=await sales.create(owner.id,organization.id,{customerId:customer.id,title:'Existing quote',currency:'USD',items:[{description:'Services',quantity:1,unitMinor:'12345'}]}),issued=await sales.issue(owner.id,organization.id,quote.id,{version:quote.version}),accepted=await sales.decide(owner.id,organization.id,quote.id,{version:issued.version,approvalReference:'Fictional existing approval'},true);await sales.convert(owner.id,organization.id,quote.id,{version:accepted.version});
 const before=await snapshot(),checksums=(await connection.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 await connection.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE,CREATE ON SCHEMA novaworks TO ${role}; GRANT ALL ON ALL TABLES IN SCHEMA novaworks TO ${role}; ALTER TABLE novaworks.platform_tasks OWNER TO ${role}; SET ROLE ${role}`);
 await migratePlatform(db);await migratePlatform(db);await connection.query('RESET ROLE');
 assert.deepEqual(await snapshot(),before);assert.deepEqual((await connection.query("SELECT version,checksum FROM novaworks.platform_migrations WHERE version<'007_timesheets' ORDER BY version")).rows,checksums);
 for(const table of ['time_entries','time_approvals'])assert.equal((await connection.query('SELECT relforcerowsecurity FROM pg_class WHERE oid=$1::regclass',[`novaworks.platform_${table}`])).rows[0].relforcerowsecurity,true);
 const evidence={result:'PASS',migrationRole:'NOSUPERUSER NOBYPASSRLS',populatedPriorTablesPreserved:tables,priorChecksumsPreserved:true,allTimeTablesForcedRls:true,idempotent:true};await mkdir('tmp/timesheets-upgrade',{recursive:true});await writeFile('tmp/timesheets-upgrade/results.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await connection.end();}
