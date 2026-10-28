import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createCrmService} from '../src/modules/crm/service.js';
import {createPipelineService} from '../src/modules/pipeline/service.js';
import {createSalesService} from '../src/modules/sales/service.js';
import {createInvoiceService} from '../src/modules/invoicing/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createTimesheetService} from '../src/modules/timesheets/service.js';
import {createReportService} from '../src/modules/reports/service.js';
const bad=code=>e=>e.code===code;
async function setup(){
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),crm=createCrmService(db),sales=createSalesService(db),invoices=createInvoiceService(db),reports=createReportService(db,{clock:()=>Date.parse('2099-12-31T12:00:00Z')});
 const [owner,manager,member,beta]=await Promise.all(['owner','manager','member','beta'].map(name=>platform.register({name,email:`${name}@reports.test`,password:'reports-test-password'}))),a=await platform.createOrganization(owner.id,{name:'Alpha'}),b=await platform.createOrganization(beta.id,{name:'Beta'});
 for(const [person,role]of[[manager,'MANAGER'],[member,'MEMBER']]){const invite=await platform.invite(owner.id,a.id,{email:person.email,role});await platform.acceptInvitation(person.id,a.id,invite.token);}
 async function order(who,company,unitMinor,currency='USD'){
  const customer=await crm.create(who.id,company.id,{name:'Report buyer'}),q=await sales.create(who.id,company.id,{customerId:customer.id,title:'Report source',currency,items:[{description:'Service',quantity:1,unitMinor}]}),issued=await sales.issue(who.id,company.id,q.id,{version:q.version}),accepted=await sales.decide((company.id===a.id?owner:beta).id,company.id,q.id,{version:issued.version,approvalReference:'Fictional approval'},true);return(await sales.convert((company.id===a.id?owner:beta).id,company.id,q.id,{version:accepted.version})).order;
 }
 async function invoice(unitMinor,currency='USD',issue=true){const source=await order(owner,a,unitMinor,currency);let entry=(await invoices.create(owner.id,a.id,{salesOrderId:source.id})).invoice;entry=await invoices.update(owner.id,a.id,entry.id,{version:entry.version,dueOn:'2099-12-01'});if(issue)entry=await invoices.issue(owner.id,a.id,entry.id,{version:entry.version});return entry;}
 return {db,platform,crm,sales,invoices,reports,owner,manager,member,beta,a,b,order,invoice};
}
test('reports: current invoice evidence nets reversals/credits without joins multiplying totals; currencies and drafts stay separate',async()=>{
 const s=await setup(),{reports:r,invoices:i,owner:o,a}=s;
 try{
  let first=await s.invoice('10000');const p1=await i.pay(o.id,a.id,first.id,{version:first.version,requestId:'one',amountMinor:'2000',currency:'USD',paidOn:'2026-01-01',reference:'First receipt'});const p2=await i.pay(o.id,a.id,first.id,{version:p1.invoice.version,requestId:'two',amountMinor:'1000',currency:'USD',paidOn:'2026-01-01',reference:'Second receipt'});await i.reverse(o.id,a.id,first.id,p1.payment.id,{version:p2.invoice.version,reason:'Incorrect evidence'});
  const credited=await s.invoice('5000');await i.credit(o.id,a.id,credited.id,{version:credited.version,reason:'Cancelled order'});await s.invoice('7000','GBP');await s.invoice('999999','USD',false);
  const report=await r.get(o.id,a.id,'financial');assert.deepEqual(report.currencies,[{currency:'GBP',count:'1',issued_minor:'7000',credited_minor:'0',paid_minor:'0',outstanding_minor:'7000',overdue_minor:'7000'},{currency:'USD',count:'2',issued_minor:'15000',credited_minor:'5000',paid_minor:'1000',outstanding_minor:'9000',overdue_minor:'9000'}]);
  assert.equal((await r.get(o.id,a.id,'financial',{currency:'GBP'})).currencies.length,1);assert.deepEqual((await r.get(s.beta.id,s.b.id,'financial')).currencies,[]);
  await assert.rejects(r.get(s.manager.id,a.id,'financial'),bad('ROLE_FORBIDDEN'));await assert.rejects(r.get(s.member.id,a.id,'financial',{},true),bad('ROLE_FORBIDDEN'));await assert.rejects(r.get(o.id,s.b.id,'financial'),bad('TENANT_FORBIDDEN'));
  await r.get(o.id,a.id,'financial',{},true);assert.equal(s.db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='report.exported'").get().n,1);
  for(const filters of [{currency:'EUR'},{currency:['USD']},{organizationId:s.b.id},{from:'2020-01-01'}])await assert.rejects(r.get(o.id,a.id,'financial',filters),bad('BAD_INPUT'));
 }finally{s.db.close();}
});
test('reports: delivery and sales respect manager/member scopes and approved-time boundaries; exact totals exceed native integer range',async()=>{
 const s=await setup(),{db,platform:p,reports:r,owner:o,manager:m,member:w,a}=s;
 try{
  const tasks=createTaskService(db),time=createTimesheetService(db);
  for(const [name,manager,minutes]of[['Managed',m,60],['Private',o,90]]){
   const project=await p.createProject(o.id,a.id,{name,managerId:manager.id,deadline:'2099-12-31'}),task=await tasks.create(o.id,a.id,{projectId:project.id,title:name,description:'Work',assigneeId:w.id,deadline:'2099-12-01',estimatedHours:2}),entry=(await time.create(w.id,a.id,{requestId:name,projectId:project.id,taskId:task.id,workDate:'2026-01-01',minutes,billable:true,description:'Work'})).entry,submitted=await time.submit(w.id,a.id,entry.id,{version:entry.version});await time.review(o.id,a.id,entry.id,{version:submitted.version,decision:'APPROVE',note:'Confirmed'});
   await time.create(w.id,a.id,{requestId:`draft-${name}`,projectId:project.id,taskId:task.id,workDate:'2026-01-01',minutes:15,billable:true,description:'Private draft'});
  }
  assert.equal((await r.get(m.id,a.id,'delivery')).projects[0].count,'1');assert.equal((await r.get(m.id,a.id,'delivery')).approvedTime.minutes,'60');assert.equal((await r.get(w.id,a.id,'delivery')).approvedTime.minutes,'150');assert.equal((await r.get(o.id,a.id,'delivery')).approvedTime.minutes,'150');await assert.rejects(r.get(w.id,a.id,'sales'),bad('ROLE_FORBIDDEN'));
  await s.order(m,a,'10000');await s.order(o,a,'20000');assert.equal((await r.get(m.id,a.id,'sales')).orders[0].amount_minor,'10000');assert.equal((await r.get(o.id,a.id,'sales')).orders[0].amount_minor,'30000');
  const quoteCustomer=await s.crm.create(o.id,a.id,{name:'Revision buyer'}),quote=await s.sales.create(o.id,a.id,{customerId:quoteCustomer.id,title:'Revision test',currency:'USD',items:[{description:'Terms',quantity:1,unitMinor:'100'}]}),issuedQuote=await s.sales.issue(o.id,a.id,quote.id,{version:quote.version});await s.sales.revise(o.id,a.id,quote.id,{version:issuedQuote.version});const currentQuotes=(await r.get(o.id,a.id,'sales')).quotes;assert.ok(!currentQuotes.some(q=>q.status==='SUPERSEDED'));assert.equal(currentQuotes.find(q=>q.status==='DRAFT').amount_minor,'100');
  const customer=await s.crm.create(o.id,a.id,{name:'Large-value test buyer'}),insert=db.prepare("INSERT INTO platform_deals(organization_id,id,customer_id,name,owner_id,stage_code,amount_minor,currency,created_at,updated_at) VALUES(?,?,?,?,?,'NEW',?,'PKR',?,?)");for(let n=0;n<1025;n++)insert.run(a.id,randomUUID(),customer.id,'Exact test deal',o.id,9007199254740991,'now','now');
  const big=(await r.get(o.id,a.id,'sales',{currency:'PKR'})).deals[0];assert.equal(big.amount_minor,String(9007199254740991n*1025n));assert.equal(big.count,'1025');assert.deepEqual((await r.get(m.id,a.id,'sales',{currency:'PKR'})).deals,[]);
 }finally{db.close();}
});
