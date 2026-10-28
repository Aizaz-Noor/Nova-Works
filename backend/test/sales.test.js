import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform,migrations} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createCrmService} from '../src/modules/crm/service.js';
import {createPipelineService} from '../src/modules/pipeline/service.js';
import {calculateItems,createSalesService} from '../src/modules/sales/service.js';
const item={description:'Implementation',quantity:2,unitMinor:'125050',taxRateBps:1750};
async function setup(){
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),crm=createCrmService(db),sales=createSalesService(db),pipeline=createPipelineService(db);
 const users=await Promise.all(['owner','manager','member','beta'].map(name=>platform.register({name,email:`${name}@sales.test`,password:'sales-test-password'})));const[o,m,member,beta]=users,company=await platform.createOrganization(o.id,{name:'Alpha'}),other=await platform.createOrganization(beta.id,{name:'Beta'});
 for(const [person,role]of[[m,'MANAGER'],[member,'MEMBER']]){const invite=await platform.invite(o.id,company.id,{email:person.email,role});await platform.acceptInvitation(person.id,company.id,invite.token);}
 const customer=await crm.create(m.id,company.id,{name:'Client Original',email:'client@sales.test'});return{db,platform,crm,sales,pipeline,o,m,member,beta,company,other,customer};
}
const bad=code=>error=>error.code===code;

test('sales arithmetic: exact integer money, per-line rounding, aggregate overflow and strict inputs',()=>{
 const result=calculateItems([item]);assert.equal(result.subtotal_minor,'250100');assert.equal(result.tax_minor,'43768');assert.equal(result.total_minor,'293868');
 assert.equal(calculateItems([{...item,quantity:1,unitMinor:'1',taxRateBps:5000},{...item,quantity:1,unitMinor:'1',taxRateBps:5000}]).total_minor,'4');
 assert.equal(calculateItems([{...item,quantity:1,unitMinor:'9007199254740991',taxRateBps:0}]).total_minor,'9007199254740991');
 for(const changes of [{quantity:1.5},{quantity:0},{quantity:1000001},{unitMinor:123},{unitMinor:'01'},{unitMinor:'1.5'},{unitMinor:'9007199254740992'},{taxRateBps:10001},{taxRateBps:1.1},{taxRateBps:null},{description:'bad\0'},{totalMinor:'1'}])assert.throws(()=>calculateItems([{...item,...changes}]),bad('BAD_INPUT'));
 assert.throws(()=>calculateItems([{...item,unitMinor:'9007199254740991'}]),bad('AMOUNT_RANGE'));assert.throws(()=>calculateItems([]),bad('BAD_INPUT'));assert.throws(()=>calculateItems(Array(51).fill(item)),bad('BAD_INPUT'));
});

test('sales: quote revisions, snapshot approval and immutable replay-safe order with role/tenant boundaries',async()=>{
 const{db,crm,sales:s,pipeline,o,m,member,beta,company:a,other:b,customer}=await setup();
 try{
  const deal=await pipeline.createDeal(m.id,a.id,{customerId:customer.id,name:'Delivery opportunity'});
  const quote=await s.create(m.id,a.id,{customerId:customer.id,dealId:deal.id,title:'Website quote',currency:'USD',terms:'50% on kickoff',validUntil:'2099-12-31',items:[item]});assert.equal(quote.total_minor,'293868');assert.equal(quote.items.length,1);
  await assert.rejects(s.quotes(member.id,a.id),bad('ROLE_FORBIDDEN'));await assert.rejects(s.quote(beta.id,b.id,quote.id),bad('NOT_FOUND'));await assert.rejects(s.quote(o.id,b.id,quote.id),bad('TENANT_FORBIDDEN'));
  await assert.rejects(s.update(m.id,a.id,quote.id,{version:2,title:'stale'}),bad('VERSION_CONFLICT'));
  const saved=await s.update(m.id,a.id,quote.id,{version:1,terms:'50% on kickoff, balance on delivery'});assert.equal(saved.version,2);
  await assert.rejects(s.convert(m.id,a.id,quote.id,{version:2}),bad('QUOTE_NOT_ACCEPTED'));
  const issued=await s.issue(m.id,a.id,quote.id,{version:2});assert.equal(issued.status,'ISSUED');
  await assert.rejects(s.update(m.id,a.id,quote.id,{version:issued.version,title:'forged'}),bad('QUOTE_LOCKED'));
  assert.throws(()=>db.prepare('UPDATE platform_quotes SET terms=? WHERE id=?').run('rewrite',quote.id),/immutable/);assert.throws(()=>db.prepare("UPDATE platform_quotes SET status='DRAFT' WHERE id=?").run(quote.id),/transition/);
  assert.throws(()=>db.prepare('UPDATE platform_quote_items SET description=? WHERE quote_id=?').run('rewrite',quote.id),/immutable/);assert.throws(()=>db.prepare('DELETE FROM platform_quote_items WHERE quote_id=?').run(quote.id),/immutable/);
  await assert.rejects(s.decide(m.id,a.id,quote.id,{version:issued.version,approvalReference:'Unauthorized'},true),bad('ROLE_FORBIDDEN'));
  const revisions=await Promise.all([s.revise(m.id,a.id,quote.id,{version:issued.version}),s.revise(m.id,a.id,quote.id,{version:issued.version})]);assert.deepEqual(revisions.map(r=>r.replayed).sort(),[false,true]);assert.equal(revisions[0].quote.id,revisions[1].quote.id);
  const revised=revisions[0].quote;assert.equal((await s.quote(o.id,a.id,quote.id)).status,'SUPERSEDED');await assert.rejects(s.decide(o.id,a.id,quote.id,{version:issued.version,approvalReference:'Old'},true),bad('VERSION_CONFLICT'));
  const second=await s.issue(m.id,a.id,revised.id,{version:revised.version});await crm.update(o.id,a.id,customer.id,{version:customer.version,name:'Changed after issue'});
  await assert.rejects(s.decide(o.id,a.id,second.id,{version:second.version,approvalReference:''},true),bad('BAD_INPUT'));
  const accepted=await s.decide(o.id,a.id,second.id,{version:second.version,approvalReference:'Customer email reference 42'},true);assert.equal(accepted.accepted_by,o.id);assert.equal(accepted.customer_name,'Client Original');assert.equal(accepted.terms,saved.terms);
  await assert.rejects(s.revise(o.id,a.id,accepted.id,{version:accepted.version}),bad('QUOTE_LOCKED'));assert.throws(()=>db.prepare("UPDATE platform_quotes SET approval_reference='replacement' WHERE id=?").run(accepted.id),/transition/);
  const orders=await Promise.all([s.convert(m.id,a.id,accepted.id,{version:accepted.version}),s.convert(m.id,a.id,accepted.id,{version:accepted.version})]);assert.deepEqual(orders.map(r=>r.replayed).sort(),[false,true]);assert.equal(orders[0].order.id,orders[1].order.id);const order=orders[0].order;
  for(const field of ['terms','currency','customer_name','customer_email','subtotal_minor','tax_minor','total_minor','approval_reference','accepted_by','accepted_at'])assert.equal(order[field],accepted[field]);assert.equal(order.quote_version,accepted.version);assert.deepEqual(order.items.map(({order_id,...row})=>row),accepted.items.map(({quote_id,...row})=>row));
  await assert.rejects(s.order(beta.id,b.id,order.id),bad('NOT_FOUND'));assert.throws(()=>db.prepare('UPDATE platform_sales_orders SET title=? WHERE id=?').run('rewrite',order.id),/immutable/);assert.throws(()=>db.prepare('DELETE FROM platform_sales_order_items WHERE order_id=?').run(order.id),/immutable/);
  assert.equal((await s.quotes(o.id,a.id,{q:'Website',status:'ACCEPTED'})).pagination.total,1);assert.equal((await s.orders(o.id,a.id,{q:'Client Original'})).pagination.total,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='sales_order.created'").get().n,1);
 }finally{db.close();}
});

test('sales: strict fields, invalid relations, expired decisions, decline/revision and migration preservation',async()=>{
 const{db,sales:s,crm,pipeline,o,m,beta,company:a,other:b,customer}=await setup();
 try{
  const base={customerId:customer.id,title:'Expired',currency:'USD',validUntil:'2000-01-01',items:[item]};const quote=await s.create(m.id,a.id,base);await assert.rejects(s.issue(m.id,a.id,quote.id,{version:1}),bad('QUOTE_EXPIRED'));
  await assert.rejects(s.create(m.id,a.id,{...base,totalMinor:'1'}),bad('BAD_INPUT'));await assert.rejects(s.create(m.id,a.id,{...base,validUntil:'2027-02-30'}),bad('BAD_INPUT'));
  const other=await crm.create(beta.id,b.id,{name:'Foreign'});await assert.rejects(s.create(m.id,a.id,{...base,customerId:other.id}),bad('NOT_FOUND'));
  const separate=await crm.create(m.id,a.id,{name:'Separate customer'}),separateDeal=await pipeline.createDeal(m.id,a.id,{customerId:separate.id,name:'Separate deal'});await assert.rejects(s.create(m.id,a.id,{...base,dealId:separateDeal.id}),bad('BAD_RELATION'));await assert.rejects(s.quote(m.id,a.id,'bad\0'),bad('BAD_INPUT'));
  const owned=await crm.create(o.id,a.id,{name:'Owner customer'});await assert.rejects(s.create(m.id,a.id,{...base,customerId:owned.id}),bad('ROLE_FORBIDDEN'));
  const valid=await s.update(m.id,a.id,quote.id,{version:1,validUntil:null});const issued=await s.issue(m.id,a.id,quote.id,{version:valid.version});const declined=await s.decide(o.id,a.id,quote.id,{version:issued.version,reason:'Outside budget'},false);assert.equal(declined.status,'DECLINED');await assert.rejects(s.convert(o.id,a.id,quote.id,{version:declined.version}),bad('QUOTE_NOT_ACCEPTED'));assert.equal((await s.revise(m.id,a.id,quote.id,{version:declined.version})).quote.status,'DRAFT');
  const before=db.prepare('SELECT version,checksum FROM platform_migrations ORDER BY version').all();await migratePlatform(db);assert.deepEqual(db.prepare('SELECT version,checksum FROM platform_migrations ORDER BY version').all(),before);
 }finally{db.close();}
 const fresh=openDatabase(':memory:');try{fresh.exec('CREATE TABLE platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');for(const migration of migrations.slice(0,4)){fresh.exec(migration.sql);fresh.prepare('INSERT INTO platform_migrations VALUES (?,?,?)').run(migration.version,createHash('sha256').update(migration.sql).digest('hex'),'prior');}const before=fresh.prepare('SELECT version,checksum FROM platform_migrations ORDER BY version').all();await migratePlatform(fresh);assert.deepEqual(fresh.prepare("SELECT version,checksum FROM platform_migrations WHERE version<'006_sales' ORDER BY version").all(),before);}finally{fresh.close();}
});

test('sales: acceptance checks current UTC expiry rather than only the issue date',async()=>{
 const {db,sales,company,customer,o}=await setup();const RealDate=globalThis.Date;let instant=RealDate.parse('2030-01-01T12:00:00Z');
 class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}}
 globalThis.Date=FixedDate;
 try{
  const quote=await sales.create(o.id,company.id,{customerId:customer.id,title:'Expires today',currency:'USD',validUntil:'2030-01-01',items:[item]});const issued=await sales.issue(o.id,company.id,quote.id,{version:quote.version});instant=RealDate.parse('2030-01-02T00:00:00Z');
  await assert.rejects(sales.decide(o.id,company.id,issued.id,{version:issued.version,approvalReference:'Late approval'},true),bad('QUOTE_EXPIRED'));assert.equal((await sales.quote(o.id,company.id,issued.id)).status,'ISSUED');
 }finally{globalThis.Date=RealDate;db.close();}
});
