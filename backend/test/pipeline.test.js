import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { migratePlatform,migrations } from '../src/platform/migrations.js';
import { createPlatformService } from '../src/platform/service.js';
import { createCrmService } from '../src/modules/crm/service.js';
import { createPipelineService } from '../src/modules/pipeline/service.js';

async function setup(){const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),pipeline=createPipelineService(db),crm=createCrmService(db),password='pipeline-test-password-123';const people=[];for(const name of ['Owner','Manager','Member','Beta'])people.push(await platform.register({name,email:`${name.toLowerCase()}@pipeline.test`,password}));const [owner,manager,member,beta]=people,a=await platform.createOrganization(owner.id,{name:'Alpha'}),b=await platform.createOrganization(beta.id,{name:'Beta'});for(const [person,role] of [[manager,'MANAGER'],[member,'MEMBER']]){const invitation=await platform.invite(owner.id,a.id,{email:person.email,role});await platform.acceptInvitation(person.id,a.id,invitation.token);}return {db,platform,pipeline,crm,owner,manager,member,beta,a,b,password};}

test('pipeline: atomic conversion, won delivery, concurrent replay, precision, ownership and validation',async()=>{
 const s=await setup();const {db,pipeline:p,crm,owner:o,manager:m,member,beta,a,b}=s;
 try{
  assert.equal((await p.stages(o.id,a.id)).stages.length,5);
  await assert.rejects(p.leads(member.id,a.id),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(p.leads(o.id,b.id),error=>error.code==='TENANT_FORBIDDEN');
  const lead=await p.createLead(m.id,a.id,{name:'Buyer',companyName:'Acme',email:'BUYER@ACME.TEST',followUpOn:'2027-01-20'});
  assert.equal(lead.email,'buyer@acme.test');assert.equal(lead.status,'NEW');
  await assert.rejects(p.convertLead(m.id,a.id,lead.id,{version:1}),error=>error.code==='LEAD_NOT_QUALIFIED');
  await assert.rejects(p.lead(beta.id,b.id,lead.id),error=>error.code==='NOT_FOUND');
  const qualified=await p.updateLead(m.id,a.id,lead.id,{version:1,status:'QUALIFIED'});
  await assert.rejects(p.updateLead(m.id,a.id,lead.id,{version:1,name:'Stale'}),error=>error.code==='VERSION_CONFLICT');
  const conversions=await Promise.all([p.convertLead(m.id,a.id,lead.id,{version:qualified.version}),p.convertLead(m.id,a.id,lead.id,{version:qualified.version})]);
  assert.deepEqual(conversions.map(result=>result.replayed).sort(),[false,true]);assert.equal(conversions[0].deal.id,conversions[1].deal.id);
  const converted=conversions[0];assert.equal(converted.customer.status,'PROSPECT');assert.equal(converted.deal.stage_code,'NEW');assert.equal(converted.lead.status,'CONVERTED');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_customers').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_contacts').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_deals').get().n,1);
  await assert.rejects(p.updateLead(m.id,a.id,lead.id,{version:converted.lead.version,notes:'Immutable'}),error=>error.code==='LEAD_CONVERTED');
  const otherCustomer=await crm.create(o.id,a.id,{name:'Another'});
  await assert.rejects(p.convertLead(m.id,a.id,lead.id,{version:2,customerId:otherCustomer.id}),error=>error.code==='CONVERSION_TARGET_MISMATCH');
  const otherLead=await p.createLead(o.id,a.id,{name:'Private',companyName:'Owner Company'});
  await assert.rejects(p.updateLead(m.id,a.id,otherLead.id,{version:1,notes:'No'}),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(p.createLead(m.id,a.id,{name:'x',companyName:'y',ownerId:o.id}),error=>error.code==='ROLE_FORBIDDEN');
  for(const value of [{name:'NUL\0',companyName:'x'},{name:'x',companyName:'x',role:'OWNER'},{name:'x',companyName:'x',email:'invalid'},{name:'x',companyName:'x',followUpOn:'2027-02-30'}])await assert.rejects(p.createLead(o.id,a.id,value),error=>error.code==='BAD_INPUT');
  const deal=await p.updateDeal(m.id,a.id,converted.deal.id,{version:1,amountMinor:'9007199254740991',currency:'PKR',stage:'PROPOSAL',expectedCloseOn:'2027-02-28'});
  assert.equal(deal.amount_minor,'9007199254740991');assert.equal(typeof deal.amount_minor,'string');
  for(const value of ['01','1.0','-1','1e3','9007199254740992',1,{},''])await assert.rejects(p.updateDeal(m.id,a.id,deal.id,{version:deal.version,amountMinor:value}),error=>error.code==='BAD_INPUT');
  await assert.rejects(p.updateDeal(m.id,a.id,deal.id,{version:deal.version,currency:'EUR'}),error=>error.code==='BAD_INPUT');
  await assert.rejects(p.updateDeal(m.id,a.id,deal.id,{version:deal.version,stage:'LOST'}),error=>error.code==='BAD_INPUT');
  await assert.rejects(p.createProject(m.id,a.id,deal.id,{version:deal.version}),error=>error.code==='DEAL_NOT_WON');
  const won=await p.updateDeal(m.id,a.id,deal.id,{version:deal.version,stage:'WON'});assert.ok(won.closed_at);
  await assert.rejects(p.updateDeal(m.id,a.id,deal.id,{version:won.version,stage:'NEW'}),error=>error.code==='DEAL_CLOSED');
  const deliveries=await Promise.all([p.createProject(m.id,a.id,deal.id,{version:won.version,name:'Acme delivery',deadline:'2027-04-01'}),p.createProject(m.id,a.id,deal.id,{version:won.version,name:'Acme delivery',deadline:'2027-04-01'})]);
  assert.deepEqual(deliveries.map(result=>result.replayed).sort(),[false,true]);assert.equal(deliveries[0].project.id,deliveries[1].project.id);
  assert.equal(deliveries[0].project.version,1);assert.equal(deliveries[1].project.version,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_projects').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_deal_projects').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_project_customers').get().n,1);
  assert.equal((await crm.projects(m.id,a.id,converted.customer.id)).projects[0].id,deliveries[0].project.id);
  await assert.rejects(p.createProject(m.id,a.id,deal.id,{version:won.version,name:'Different'}),error=>error.code==='PROJECT_OPTIONS_MISMATCH');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='lead.converted'").get().n,1);assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='deal.project_created'").get().n,1);
  // Replays recheck current ownership, not only possession of the original IDs.
  await crm.update(o.id,a.id,converted.customer.id,{version:1,ownerId:o.id});
  await assert.rejects(p.convertLead(m.id,a.id,lead.id,{version:2}),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(p.createProject(m.id,a.id,deal.id,{version:won.version}),error=>error.code==='ROLE_FORBIDDEN');
  const second=await p.createLead(o.id,a.id,{name:'Same Buyer',companyName:'Acme',email:'buyer@acme.test'}),secondQualified=await p.updateLead(o.id,a.id,second.id,{version:1,status:'QUALIFIED'});
  const secondConversion=await p.convertLead(o.id,a.id,second.id,{version:secondQualified.version,customerId:converted.customer.id});assert.equal(secondConversion.contact.id,converted.contact.id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM platform_contacts').get().n,1);
  const betaCustomer=await crm.create(beta.id,b.id,{name:'Beta Private'});
  await assert.rejects(p.createDeal(o.id,a.id,{name:'Wrong tenant',customerId:betaCustomer.id}),error=>error.code==='NOT_FOUND');
  const manual=await p.createDeal(o.id,a.id,{name:'Manual',customerId:otherCustomer.id,amountMinor:'0',currency:'GBP'});assert.equal(manual.amount_minor,'0');
  const lost=await p.updateDeal(o.id,a.id,manual.id,{version:1,stage:'LOST',lostReason:'Budget unavailable'});assert.ok(lost.closed_at);
  await assert.rejects(p.updateDeal(o.id,a.id,manual.id,{version:lost.version,notes:'Changed'}),error=>error.code==='DEAL_CLOSED');
  assert.equal((await p.leads(o.id,a.id,{status:'CONVERTED',limit:'1'})).pagination.total,2);assert.equal((await p.deals(o.id,a.id,{stage:'LOST'})).deals.length,1);
  assert.throws(()=>db.prepare('INSERT INTO platform_deals(organization_id,id,customer_id,name,owner_id,stage_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(a.id,'bad-fk',betaCustomer.id,'Wrong',o.id,'NEW','now','now'),/FOREIGN KEY/);
 }finally{db.close();}
});

test('pipeline real HTTP lead → qualification → conversion → won deal → linked project',async()=>{
 const s=await setup(),{db,owner,a,password}=s;const server=createApp({db,erpEnabled:true,production:false,sessionSecret:'pipeline-test-secret-longer-than-32-chars',loginLimit:100}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 async function call(path,method='GET',body,status=200){const response=await fetch(base+path,{method,headers:{Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
 try{
  await call('/api/auth/login','POST',{email:owner.email,password});await call('/api/v1/organizations/select','POST',{organizationId:a.id});assert.equal((await call('/api/v1/pipeline/stages')).stages.length,5);
  const lead=await call('/api/v1/leads','POST',{name:'HTTP Buyer',companyName:'HTTP Company',email:'http@customer.test'},201);
  const qualified=await call(`/api/v1/leads/${lead.id}`,'PATCH',{version:lead.version,status:'QUALIFIED'});
  const converted=await call(`/api/v1/leads/${lead.id}/convert`,'POST',{version:qualified.version});
  const replay=await call(`/api/v1/leads/${lead.id}/convert`,'POST',{version:qualified.version});assert.equal(replay.replayed,true);assert.equal(replay.deal.id,converted.deal.id);
  const won=await call(`/api/v1/deals/${converted.deal.id}`,'PATCH',{version:1,stage:'WON',amountMinor:'12345',currency:'USD'});assert.equal(won.amount_minor,'12345');
  const project=await call(`/api/v1/deals/${won.id}/project`,'POST',{version:won.version,name:'HTTP Delivery'});assert.equal(project.project.name,'HTTP Delivery');
  assert.equal((await call(`/api/v1/deals/${won.id}/project`,'POST',{version:won.version,name:'HTTP Delivery'})).replayed,true);
  assert.equal((await call(`/api/v1/customers/${converted.customer.id}/projects`)).projects[0].id,project.project.id);
  await call('/api/v1/leads','POST',{name:'Unknown field',companyName:'x',role:'OWNER'},400);
  await call('/api/v1/leads/%00','GET',undefined,400);
  await call(`/api/v1/deals/${won.id}`,'PATCH',{version:won.version,stage:'NEW'},409);
  assert.equal((await call('/api/v1/deals?stage=WON&limit=1')).pagination.total,1);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});

test('migration005 backfills existing organizations and preserves prior migration checksums',async()=>{
 const db=openDatabase(':memory:');try{
  db.exec('CREATE TABLE platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');
  for(const migration of migrations.slice(0,3)){db.exec(migration.sql);db.prepare('INSERT INTO platform_migrations VALUES (?,?,?)').run(migration.version,createHash('sha256').update(migration.sql).digest('hex'),'baseline');}
  db.prepare("INSERT INTO users VALUES ('old-owner','Old','old@example.test','hash','AGENT','Old','[]')").run();
  db.prepare("INSERT INTO platform_organizations VALUES ('old-org','Old company','old-owner','baseline')").run();
  db.prepare("INSERT INTO platform_memberships VALUES ('old-org','old-owner','OWNER','baseline')").run();
  const before=db.prepare('SELECT version,checksum FROM platform_migrations ORDER BY version').all();await migratePlatform(db);await migratePlatform(db);
  assert.deepEqual(db.prepare('SELECT version,checksum FROM platform_migrations WHERE version < ? ORDER BY version').all('005_pipeline'),before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_pipeline_stages WHERE organization_id='old-org'").get().n,5);
  assert.equal((await createPipelineService(db).stages('old-owner','old-org')).stages.length,5);
  for(const name of ['pipeline_stages','leads','deals','deal_projects'])assert.ok(migrations[3].postgresSql.includes(`ALTER TABLE novaworks.platform_${name} FORCE ROW LEVEL SECURITY`));
 }finally{db.close();}
});
