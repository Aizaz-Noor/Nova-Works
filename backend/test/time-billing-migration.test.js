import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migrations,migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createCrmService} from '../src/modules/crm/service.js';
import {createSalesService} from '../src/modules/sales/service.js';
import {createInvoiceService} from '../src/modules/invoicing/service.js';
import {timeBillingSql,timeBillingPostgresSql} from '../src/modules/invoicing/timeBillingSchema.js';

async function priorDatabase(){const db=openDatabase(':memory:');db.exec('CREATE TABLE platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL); BEGIN IMMEDIATE;');for(const m of migrations.filter(m=>Number(m.version.slice(0,3))<=22)){db.exec(m.sql);db.prepare('INSERT INTO platform_migrations VALUES(?,?,?)').run(m.version,createHash('sha256').update(m.sql).digest('hex'),'prior');}db.exec('COMMIT');return db;}
test('time billing: actual populated 022 forward upgrade preserves all legacy invoice history and repeat migration',async()=>{
 const db=await priorDatabase();let inserted=false;
 try{
  // Build the historical022 fixture through current business services without
  // pretending its old membership schema already contains024 columns. This
  // fixture-only projection ends before the real migration runner is exercised.
  let historical=true;
  const fixtureDb={kind:db.kind,exec:sql=>db.exec(sql),prepare(sql){
   const membership=historical&&/SELECT \* FROM platform_memberships/.test(sql);
   const statement=db.prepare(historical?sql.replace(" AND status='ACTIVE'",''):sql);
   if(!membership)return statement;
   return {all:(...values)=>statement.all(...values).map(row=>({...row,status:'ACTIVE',version:1}))};
  }};
  const p=createPlatformService(fixtureDb),crm=createCrmService(fixtureDb),sales=createSalesService(fixtureDb),inv=createInvoiceService(fixtureDb);
  const owner=await p.register({name:'Owner',email:'owner@upgrade-time.test',password:'upgrade-time-password'}),org=await p.createOrganization(owner.id,{name:'Upgrade company'}),customer=await crm.create(owner.id,org.id,{name:'Client'});
  let quote=await sales.create(owner.id,org.id,{customerId:customer.id,title:'Historical delivery',currency:'USD',terms:'Agreed',items:[{description:'Delivery',quantity:2,unitMinor:'10001',taxRateBps:500}]});
  quote=await sales.issue(owner.id,org.id,quote.id,{version:quote.version});quote=await sales.decide(owner.id,org.id,quote.id,{version:quote.version,approvalReference:'Acceptance'},true);
  const order=(await sales.convert(owner.id,org.id,quote.id,{version:quote.version})).order;
  let invoice=(await inv.create(owner.id,org.id,{salesOrderId:order.id})).invoice;invoice=await inv.issue(owner.id,org.id,invoice.id,{version:invoice.version});
  const paid=await inv.pay(owner.id,org.id,invoice.id,{version:invoice.version,requestId:'pay',amountMinor:'100',currency:'USD',paidOn:'2026-01-01',reference:'Receipt'});invoice=paid.invoice;
  invoice=(await inv.reverse(owner.id,org.id,invoice.id,paid.payment.id,{version:invoice.version,reason:'Correction'})).invoice;
  invoice=(await inv.credit(owner.id,org.id,invoice.id,{version:invoice.version,reason:'Replacement'})).invoice;
  await inv.replacement(owner.id,org.id,invoice.id,{version:invoice.version});
  historical=false;
  const names=['sales_orders','sales_order_items','client_invoices','invoice_items','payment_records','credit_notes','invoice_counters'],before=Object.fromEntries(names.map(n=>[n,db.prepare(`SELECT * FROM platform_${n} ORDER BY 1,2`).all().map(r=>({...r}))]));
  if(!migrations.some(m=>m.version.startsWith('023_'))){migrations.push({version:'023_time_billing',sql:timeBillingSql(),postgresSql:timeBillingPostgresSql()});inserted=true;}
  const forward=migrations.find(m=>m.version.startsWith('023_')),savedSql=forward.sql,historyBefore=db.prepare('SELECT * FROM platform_migrations ORDER BY version').all();
  // Inject a SQL error after the original graph was emptied/dropped. The actual
  // migration runner must roll back DDL, data, guards and checksum registration.
  forward.sql=savedSql.replace('CREATE TABLE platform_time_billing_roots','SELECT absent_injected_failure(); CREATE TABLE platform_time_billing_roots');
  await assert.rejects(migratePlatform(db),/absent_injected_failure/);forward.sql=savedSql;
  for(const name of names)assert.deepEqual(db.prepare(`SELECT * FROM platform_${name} ORDER BY 1,2`).all().map(r=>({...r})),before[name],`rollback ${name}`);
  assert.deepEqual(db.prepare('SELECT * FROM platform_migrations ORDER BY version').all(),historyBefore);
  assert.throws(()=>db.prepare('DELETE FROM platform_payment_records').run(),/immutable/);
  await migratePlatform(db);await migratePlatform(db);
  for(const name of names){const rows=db.prepare(`SELECT * FROM platform_${name} ORDER BY 1,2`).all().map(r=>({...r}));if(name==='client_invoices')for(const row of rows){assert.equal(row.source_kind,'ORDER');assert.equal(row.billing_root_id,null);delete row.source_kind;delete row.billing_root_id;}assert.deepEqual(rows,before[name],name);}
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
  assert.throws(()=>db.prepare('UPDATE platform_client_invoices SET source_kind=\'TIME\',version=version+1 WHERE id=?').run(invoice.id),/immutable/);
  assert.throws(()=>db.prepare('UPDATE platform_invoice_items SET quantity=99').run(),/immutable/);assert.throws(()=>db.prepare('DELETE FROM platform_payment_records').run(),/immutable/);assert.throws(()=>db.prepare('DELETE FROM platform_credit_notes').run(),/immutable/);
  assert.equal((await inv.invoice(owner.id,org.id,invoice.id)).settlement,'CREDITED');
  const project=await p.createProject(owner.id,org.id,{name:'Time delivery'});await crm.linkProject(owner.id,org.id,customer.id,{projectId:project.id});
  const put=(name,row)=>db.prepare(`INSERT INTO platform_${name}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
  put('billing_rates',{organization_id:org.id,id:'rate',project_id:project.id,customer_id:customer.id,currency:'USD',hourly_minor:10001,created_by:owner.id,request_id:'rate',request_hash:'hash',created_at:'now',updated_at:'now'});
  put('time_entries',{organization_id:org.id,id:'entry',user_id:owner.id,project_id:project.id,request_id:'entry',request_hash:'hash',work_date:'2026-01-01',minutes:90,billable:1,description:'Delivery',status:'APPROVED',version:3,submission_no:1,created_at:'now',updated_at:'now'});
  put('time_approvals',{organization_id:org.id,id:'approval',entry_id:'entry',submission_no:1,reviewed_version:2,reviewer_id:owner.id,decision:'APPROVE',note:'Schema fixture only',created_at:'now'});
  const root={organization_id:org.id,id:'root',request_id:'root',request_hash:'hash',created_by:owner.id,project_id:project.id,customer_id:customer.id,currency:'USD',rate_id:'rate',rate_version:1,hourly_minor:10001,created_at:'now'};put('time_billing_roots',root);
  const allocation={organization_id:org.id,root_id:'root',entry_id:'entry',entry_version:3,submission_no:1,approval_id:'approval',user_id:owner.id,project_id:project.id,customer_id:customer.id,minutes:90,rate_id:'rate',rate_version:1,hourly_minor:10001,currency:'USD',amount_minor:15002,position:1,description:'Delivery',work_date:'2026-01-01'};
  assert.throws(()=>put('time_allocations',{...allocation,minutes:1.5}),/integers/);assert.throws(()=>put('time_allocations',{...allocation,hourly_minor:10002}),/FOREIGN KEY/);put('time_allocations',allocation);
  assert.throws(()=>put('time_allocations',{...allocation,position:2}),/UNIQUE/);
  assert.throws(()=>db.exec('UPDATE platform_time_allocations SET amount_minor=1'),/immutable/);assert.throws(()=>db.exec('DELETE FROM platform_time_billing_roots'),/immutable/);
  const timeInvoice={...db.prepare('SELECT * FROM platform_client_invoices WHERE id=?').get(invoice.id),id:'time-invoice',source_kind:'TIME',billing_root_id:'root',sales_order_id:null,generation:1,supersedes_invoice_id:null,status:'DRAFT',number:null,issued_on:null,version:1,subtotal_minor:15002,tax_minor:0,total_minor:15002};
  put('client_invoices',timeInvoice);assert.throws(()=>put('client_invoices',{...timeInvoice,id:'time-duplicate'}),/UNIQUE/);
  assert.throws(()=>put('client_invoices',{...timeInvoice,id:'bad-order',source_kind:'ORDER'}),/CHECK/);assert.throws(()=>put('client_invoices',{...timeInvoice,id:'bad-time',billing_root_id:null}),/CHECK/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(inserted)migrations.pop();db.close();}
});
