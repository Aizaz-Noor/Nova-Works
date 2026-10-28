// Opt-in integration test against a NEW, disposable PostgreSQL database only.
// Never reads DATABASE_URL, never drops schemas, and refuses pre-existing tables.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migratePlatform } from '../src/platform/migrations.js';
import { createPlatformService } from '../src/platform/service.js';
import { assertPlatformRuntimeRole } from '../src/platform/runtime.js';
import { createCrmService } from '../src/modules/crm/service.js';

if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_ALLOW_CREATE !== 'disposable-only') {
 console.error('NOT RUN: set TEST_DATABASE_URL to a new disposable database and TEST_DATABASE_ALLOW_CREATE=disposable-only. DATABASE_URL is never used.');
 process.exitCode=2;
} else {
 const address=new URL(process.env.TEST_DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(address.protocol))throw new Error('TEST_DATABASE_URL must identify PostgreSQL');
 const local=['localhost','127.0.0.1','[::1]'].includes(address.hostname);
 if(!local)for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])address.searchParams.delete(key);
 const pool=new pg.Pool({connectionString:address.toString(),max:3,connectionTimeoutMillis:10000,statement_timeout:10000,...(local?{}:{ssl:{rejectUnauthorized:true,...(process.env.TEST_DATABASE_CA_CERT?{ca:process.env.TEST_DATABASE_CA_CERT}:{})}})});
 const role=`nw_tenant_test_${randomBytes(8).toString('hex')}`;
 const roleSql=`"${role}"`;
 function adapter(restricted=false){
  const db={kind:'postgres'};
  db.transaction=async work=>{
   const connection=await pool.connect();
   try{
    await connection.query('BEGIN');
    if(restricted)await connection.query(`SET LOCAL ROLE ${roleSql}`);
    const result=await work(connection);await connection.query('COMMIT');return result;
   }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
  };
  db.query=(sql,values)=>restricted?db.transaction(connection=>connection.query(sql,values)):pool.query(sql,values);
  return db;
 }
 try{
  const existing=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%' LIMIT 1");
  if(existing.rows.length)throw new Error('REFUSED: database contains application tables. Supply a new disposable database.');
  // Minimal pre-existing identity contract; the production legacy migration also
  // includes Supabase-specific role revocations unrelated to tenant isolation.
  await pool.query('CREATE SCHEMA IF NOT EXISTS novaworks');
  await pool.query(`CREATE TABLE novaworks.users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL,specialization TEXT NOT NULL,skills JSONB NOT NULL)`);
  await migratePlatform(adapter());
  await pool.query(`CREATE ROLE ${roleSql} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  // An administrative session explicitly switches to an unprivileged NOLOGIN role
  // inside every transaction. RLS evaluates the restricted current_user.
  await pool.query(`GRANT ${roleSql} TO CURRENT_USER`);
  await pool.query(`GRANT USAGE ON SCHEMA novaworks TO ${roleSql}`);
  await pool.query(`GRANT SELECT,INSERT ON novaworks.users TO ${roleSql}`);
  for(const table of ['organizations','memberships','projects','tasks','drafts','files','invitations','audit','customers','contacts','activities','project_customers','pipeline_stages','leads','deals','deal_projects','quotes','quote_items','sales_orders','sales_order_items','time_entries','time_approvals','client_invoices','invoice_items','payment_records','credit_notes','invoice_counters','ai_jobs','ai_usage','subscriptions','billing_events','billing_operations','organization_settings'])await pool.query(`GRANT ${['time_entries','client_invoices','invoice_counters','ai_jobs','ai_usage','subscriptions','billing_operations','organization_settings'].includes(table)?'SELECT,INSERT,UPDATE':['pipeline_stages','deal_projects','sales_orders','sales_order_items','time_approvals','invoice_items','payment_records','credit_notes','billing_events'].includes(table)?'SELECT,INSERT':'SELECT,INSERT,UPDATE,DELETE'} ON novaworks.platform_${table} TO ${roleSql}`);
  const db=adapter(true);
  assert.deepEqual(await assertPlatformRuntimeRole(db),{database:'postgres',databaseRls:true});
  const rights=(await db.query("SELECT has_schema_privilege(current_user,'novaworks','CREATE') AS can_create,has_table_privilege(current_user,'novaworks.platform_projects','TRUNCATE') AS can_truncate")).rows[0];
  assert.equal(rights.can_create,false);assert.equal(rights.can_truncate,false);
  const service=createPlatformService(db);
  const a=await service.register({name:'Alpha Owner',email:'alpha@tenant-test.invalid',password:'integration-test-password-123'});
  const b=await service.register({name:'Beta Owner',email:'beta@tenant-test.invalid',password:'integration-test-password-123'});
  const alpha=await service.createOrganization(a.id,{name:'Alpha Digital'});
  const beta=await service.createOrganization(b.id,{name:'Beta Consulting'});
  const pa=await service.createProject(a.id,alpha.id,{name:'Alpha Private'});
  const pb=await service.createProject(b.id,beta.id,{name:'Beta Private'});
  assert.equal((await service.listProjects(a.id,alpha.id)).length,1);
  assert.equal((await service.listOrganizations(a.id)).length,1);
  await assert.rejects(service.listProjects(a.id,beta.id),error=>error.code==='TENANT_FORBIDDEN');
  await assert.rejects(service.updateProject(a.id,alpha.id,pb.id,{name:'Stolen'}),error=>error.code==='NOT_FOUND');
  await assert.rejects(service.createProject(a.id,alpha.id,{name:'Wrong owner',managerId:b.id}),error=>error.code==='BAD_MANAGER');
  await service.transaction(b.id,beta.id,async({query})=>{
   await query('INSERT INTO novaworks.platform_drafts(organization_id,id,payload,created_by,created_at) VALUES (?,?,?,?,?)',[beta.id,'beta-draft','private',b.id,new Date().toISOString()]);
   await query('INSERT INTO novaworks.platform_files(organization_id,id,name,storage_key,created_by,created_at) VALUES (?,?,?,?,?,?)',[beta.id,'beta-file','private.pdf','private/key',b.id,new Date().toISOString()]);
  });
  for(const [kind,id] of [['drafts','beta-draft'],['files','beta-file']])await assert.rejects(service.getReference(a.id,alpha.id,kind,id),error=>error.code==='NOT_FOUND');
  assert.equal((await service.exportProjects(a.id,alpha.id)).length,1);
  // Database-level proof: bypass all service WHERE clauses, retain restricted role.
  assert.equal((await db.query('SELECT * FROM novaworks.platform_projects')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM novaworks.platform_memberships')).rows.length,0);
  await db.transaction(async connection=>{
   await connection.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[a.id,alpha.id]);
   const visible=await connection.query('SELECT * FROM novaworks.platform_projects');
   assert.deepEqual(visible.rows.map(row=>row.id),[pa.id]);
   assert.equal((await connection.query('SELECT * FROM novaworks.platform_projects WHERE id=$1',[pb.id])).rows.length,0);
   assert.equal((await connection.query('UPDATE novaworks.platform_projects SET name=$1 WHERE id=$2',['Stolen',pb.id])).rowCount,0);
  });
  await assert.rejects(db.transaction(async connection=>{
   await connection.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[a.id,alpha.id]);
   await connection.query('INSERT INTO novaworks.platform_projects(organization_id,id,name,manager_id,created_at) VALUES ($1,$2,$3,$4,$5)',[beta.id,'wrong-tenant','Wrong',b.id,new Date().toISOString()]);
  }),error=>error.code==='42501');
  await assert.rejects(db.transaction(async connection=>{
   await connection.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[a.id,alpha.id]);
   await connection.query('INSERT INTO novaworks.platform_tasks(organization_id,id,project_id,title,assignee_id,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[alpha.id,'bad-fk',pb.id,'Cross tenant',a.id,new Date().toISOString()]);
  }),error=>error.code==='23503');
  const reset=(await db.query("SELECT NULLIF(current_setting('app.organization_id',true),'') AS organization_id,NULLIF(current_setting('app.user_id',true),'') AS user_id")).rows[0];
  assert.equal(reset.organization_id,null);assert.equal(reset.user_id,null);
  assert.equal((await db.query('SELECT * FROM novaworks.platform_projects')).rows.length,0);
  // New service instance uses the existing persisted PostgreSQL records.
  assert.equal((await createPlatformService(db).listProjects(b.id,beta.id))[0].id,pb.id);
  const crm=createCrmService(db);
  const ca=await crm.create(a.id,alpha.id,{name:'Alpha Customer',email:'customer@alpha.invalid'});
  const cb=await crm.create(b.id,beta.id,{name:'Beta Customer'});
  const revised=await crm.update(a.id,alpha.id,ca.id,{version:1,status:'ACTIVE'});
  assert.equal(revised.version,2);
  await assert.rejects(crm.update(a.id,alpha.id,ca.id,{version:1,name:'Stale'}),error=>error.code==='VERSION_CONFLICT');
  await assert.rejects(crm.get(a.id,alpha.id,cb.id),error=>error.code==='NOT_FOUND');
  await crm.addContact(a.id,alpha.id,ca.id,{name:'Buyer'});
  await crm.addActivity(a.id,alpha.id,ca.id,{type:'MEETING',body:'Delivery planning'});
  await crm.linkProject(a.id,alpha.id,ca.id,{projectId:pa.id});
  assert.equal((await crm.projects(a.id,alpha.id,ca.id)).projects[0].id,pa.id);
  await assert.rejects(crm.linkProject(a.id,alpha.id,ca.id,{projectId:pb.id}),error=>error.code==='NOT_FOUND');
  for(const table of ['customers','contacts','activities','project_customers']){
   assert.equal((await db.query(`SELECT * FROM novaworks.platform_${table}`)).rows.length,0);
   await db.transaction(async connection=>{
    await connection.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[b.id,beta.id]);
    const rows=(await connection.query(`SELECT * FROM novaworks.platform_${table}`)).rows;
    assert.ok(rows.every(row=>row.organization_id===beta.id));
   });
  }
  console.log('PASS: real PostgreSQL restricted-role tenant service, raw RLS read/write isolation, composite FK, and transaction-local reset.');
  console.log('PASS: CRM customer/contact/activity/project link persistence, stale version conflict, and four-table fail-closed RLS.');
  console.log('Disposable database retained for inspection; remove it using your normal database administration process.');
 }catch(error){
  console.error(`FAIL: ${error.message}`);process.exitCode=1;
 }finally{await pool.end();}
}
