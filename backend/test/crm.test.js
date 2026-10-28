import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { migratePlatform,migrations } from '../src/platform/migrations.js';
import { createPlatformService } from '../src/platform/service.js';
import { createCrmService } from '../src/modules/crm/service.js';

async function setup(){
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),crm=createCrmService(db),password='integration-password-123';
 const users=[];for(const name of ['Owner','Manager','Member','Other'])users.push(await platform.register({name,email:`${name.toLowerCase()}@crm.test`,password}));
 const [owner,manager,member,other]=users;
 const a=await platform.createOrganization(owner.id,{name:'Alpha'}),b=await platform.createOrganization(other.id,{name:'Beta'});
 for(const [person,role] of [[manager,'MANAGER'],[member,'MEMBER']]){const invite=await platform.invite(owner.id,a.id,{email:person.email,role});await platform.acceptInvitation(person.id,a.id,invite.token);}
 return {db,platform,crm,owner,manager,member,other,a,b,password};
}

test('CRM service validates fields, ownership, optimistic concurrency and composite tenant references',async()=>{
 const s=await setup();const {db,crm,platform,owner,manager,member,other,a,b}=s;
 try{
  const customer=await crm.create(owner.id,a.id,{name:' Alpha Customer ',email:' CONTACT@EXAMPLE.COM ',website:'https://example.com',ownerId:manager.id,notes:'notes'});
  assert.equal(customer.name,'Alpha Customer');assert.equal(customer.email,'contact@example.com');assert.equal(customer.version,1);
  const beta=await crm.create(other.id,b.id,{name:'Beta Private'});
  await assert.rejects(crm.get(owner.id,a.id,beta.id),error=>error.code==='NOT_FOUND');
  await assert.rejects(crm.get(owner.id,a.id,'\0'),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.list(owner.id,b.id),error=>error.code==='TENANT_FORBIDDEN');
  await assert.rejects(crm.list(member.id,a.id),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(crm.create(owner.id,a.id,{name:'Bad owner',ownerId:other.id}),error=>error.code==='BAD_OWNER');
  await assert.rejects(crm.create(owner.id,a.id,{name:'Member owner',ownerId:member.id}),error=>error.code==='BAD_OWNER');
  await assert.rejects(crm.create(manager.id,a.id,{name:'Not mine',ownerId:owner.id}),error=>error.code==='ROLE_FORBIDDEN');
  for(const input of [{name:''},{name:'a',email:'bad'},{name:'a',website:'javascript:alert(1)'},{name:'a',website:'ftp://example.com'},{name:'a',website:'https://user:pass@example.com'},{name:'a',notes:'x'.repeat(10001)},{name:'a',phone:42},{name:'NUL\0text'},{name:'a',notes:'NUL\0text'},{name:'a',organizationId:b.id}])await assert.rejects(crm.create(owner.id,a.id,input),error=>error.code==='BAD_INPUT');
  const cleared=await crm.update(manager.id,a.id,customer.id,{version:1,email:'',phone:'',website:'',notes:'',status:'ACTIVE'});
  assert.equal(cleared.version,2);assert.equal(cleared.email,'');assert.equal(cleared.website,'');
  await assert.rejects(crm.update(owner.id,a.id,customer.id,{name:'Missing version'}),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.update(owner.id,a.id,customer.id,{version:2,owner_id:other.id}),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.update(owner.id,a.id,customer.id,{version:1,name:'Stale'}),error=>error.code==='VERSION_CONFLICT');
  const competing=await Promise.allSettled([crm.update(owner.id,a.id,customer.id,{version:2,name:'First'}),crm.update(manager.id,a.id,customer.id,{version:2,name:'Second'})]);
  assert.equal(competing.filter(result=>result.status==='fulfilled').length,1);assert.equal(competing.find(result=>result.status==='rejected').reason.code,'VERSION_CONFLICT');
  const privateCustomer=await crm.create(owner.id,a.id,{name:'Owner only'});
  await assert.rejects(crm.update(manager.id,a.id,privateCustomer.id,{version:1,notes:'Not allowed'}),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(crm.addContact(manager.id,a.id,privateCustomer.id,{name:'Wrong'}),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(crm.addActivity(manager.id,a.id,privateCustomer.id,{type:'NOTE',body:'Wrong'}),error=>error.code==='ROLE_FORBIDDEN');
  const contact=await crm.addContact(manager.id,a.id,customer.id,{name:' Ada ',email:'ADA@EXAMPLE.COM',jobTitle:' CTO '});assert.equal(contact.job_title,'CTO');assert.equal(contact.email,'ada@example.com');
  await crm.addActivity(manager.id,a.id,customer.id,{type:'CALL',body:'Agreed follow-up'});
  await assert.rejects(crm.addContact(owner.id,a.id,customer.id,{name:'x',organizationId:b.id}),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.addContact(owner.id,a.id,customer.id,{name:'NUL\0name'}),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.addActivity(owner.id,a.id,customer.id,{type:'CALL',body:'NUL\0body'}),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.addActivity(owner.id,a.id,customer.id,{type:'CALL',body:'safe',role:'OWNER'}),error=>error.code==='BAD_INPUT');
  assert.equal((await crm.contacts(owner.id,a.id,customer.id)).contacts.length,1);assert.equal((await crm.activities(owner.id,a.id,customer.id)).activities.length,1);
  await assert.rejects(crm.contacts(owner.id,a.id,beta.id),error=>error.code==='NOT_FOUND');
  await assert.rejects(crm.activities(owner.id,a.id,beta.id),error=>error.code==='NOT_FOUND');
  for(const query of [{limit:'101'},{page:'0'},{q:['bad']},{status:'DELETED'}])await assert.rejects(crm.list(owner.id,a.id,query),error=>error.code==='BAD_INPUT');
  assert.equal((await crm.list(owner.id,a.id,{q:'Owner',limit:'1'})).pagination.total,1);
  assert.equal((await crm.list(owner.id,a.id,{status:'ACTIVE'})).customers.length,1);
  const project=await platform.createProject(manager.id,a.id,{name:'Manager delivery'}),ownerProject=await platform.createProject(owner.id,a.id,{name:'Owner delivery'}),betaProject=await platform.createProject(other.id,b.id,{name:'Beta delivery'});
  const linked=await crm.linkProject(manager.id,a.id,customer.id,{projectId:project.id});assert.equal(linked.customer_id,customer.id);
  assert.equal((await crm.linkProject(manager.id,a.id,customer.id,{projectId:project.id})).project_id,project.id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='customer.project_linked'").get().n,1);
  await assert.rejects(crm.linkProject(owner.id,a.id,customer.id,{projectId:project.id,organizationId:b.id}),error=>error.code==='BAD_INPUT');
  await assert.rejects(crm.linkProject(owner.id,a.id,privateCustomer.id,{projectId:project.id}),error=>error.code==='PROJECT_ALREADY_LINKED');
  await assert.rejects(crm.linkProject(manager.id,a.id,customer.id,{projectId:ownerProject.id}),error=>error.code==='ROLE_FORBIDDEN');
  await assert.rejects(crm.linkProject(owner.id,a.id,customer.id,{projectId:betaProject.id}),error=>error.code==='NOT_FOUND');
  assert.equal((await crm.projects(owner.id,a.id,customer.id)).projects[0].id,project.id);
  const time=new Date().toISOString();
  assert.throws(()=>db.prepare('INSERT INTO platform_contacts(organization_id,id,customer_id,name,created_by,created_at) VALUES (?,?,?,?,?,?)').run(a.id,'bad-contact',beta.id,'Cross tenant',owner.id,time),/FOREIGN KEY/);
  assert.throws(()=>db.prepare('INSERT INTO platform_project_customers(organization_id,project_id,customer_id,linked_by,created_at) VALUES (?,?,?,?,?)').run(a.id,betaProject.id,customer.id,owner.id,time),/FOREIGN KEY/);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action LIKE 'customer.%' OR action IN ('contact.created','activity.created')").get().n>=8);
 }finally{db.close();}
});

test('CRM actual HTTP flow enforces selected company, role restrictions, pagination and version conflicts',async()=>{
 const s=await setup();const {db,owner,manager,member,other,a,b,password}=s;
 const server=createApp({db,erpEnabled:true,production:false,sessionSecret:'crm-test-session-secret-longer-than-32',loginLimit:100}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 function client(){let cookie='';return async(path,method='GET',body)=>{const response=await fetch(base+path,{method,headers:{Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:response.status,body:await response.json()};};}
 const ownerClient=client(),managerClient=client(),memberClient=client(),betaClient=client();
 async function login(c,user,org){assert.equal((await c('/api/auth/login','POST',{email:user.email,password})).status,200);assert.equal((await c('/api/v1/organizations/select','POST',{organizationId:org.id})).status,200);}
 try{
  await login(ownerClient,owner,a);await login(managerClient,manager,a);await login(memberClient,member,a);await login(betaClient,other,b);
  const created=await ownerClient('/api/v1/customers','POST',{name:'HTTP Customer',ownerId:manager.id});assert.equal(created.status,201);const id=created.body.id;
  const edited=await managerClient(`/api/v1/customers/${id}`,'PATCH',{version:1,status:'ACTIVE',notes:'Reviewed'});assert.equal(edited.status,200);assert.equal(edited.body.version,2);
  assert.equal((await ownerClient(`/api/v1/customers/${id}`,'PATCH',{version:1,name:'Stale'})).status,409);
  assert.equal((await memberClient('/api/v1/customers')).status,403);assert.equal((await memberClient(`/api/v1/customers/${id}`)).status,403);
  assert.equal((await betaClient(`/api/v1/customers/${id}`)).status,404);assert.equal((await betaClient(`/api/v1/customers/${id}/contacts`)).status,404);
  assert.equal((await betaClient(`/api/v1/customers/${id}/activities`,'POST',{type:'NOTE',body:'Stolen'})).status,404);
  assert.equal((await ownerClient('/api/v1/customers?limit=101')).status,400);
  const listed=await ownerClient('/api/v1/customers?status=ACTIVE&q=HTTP&limit=1');assert.equal(listed.body.pagination.total,1);assert.equal(listed.body.customers.length,1);
  const contact=await managerClient(`/api/v1/customers/${id}/contacts`,'POST',{name:'Buyer',email:'buyer@example.com'});assert.equal(contact.status,201);
  assert.equal((await managerClient(`/api/v1/customers/${id}/activities`,'POST',{type:'MEETING',body:'Next week'})).status,201);
  assert.equal((await ownerClient(`/api/v1/customers/${id}/contacts`)).body.contacts.length,1);assert.equal((await ownerClient(`/api/v1/customers/${id}/activities`)).body.activities.length,1);
  const project=await s.platform.createProject(manager.id,a.id,{name:'HTTP linked delivery'});
  assert.equal((await managerClient(`/api/v1/customers/${id}/projects`,'POST',{projectId:project.id})).status,200);
  assert.equal((await ownerClient(`/api/v1/customers/${id}/projects`)).body.projects[0].id,project.id);
  assert.equal((await betaClient(`/api/v1/customers/${id}/projects`)).status,404);
  assert.equal((await ownerClient('/api/v1/customers','POST',{name:'Invalid',website:'data:text/html,bad'})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});

test('CRM additive migration preserves applied 002/003 SQL checksums and forces four table policies',()=>{
 // Frozen from baseline 4fefac3; canonical newlines keep this portable across Git
 // checkouts. Runtime migration checksums remain unchanged and use original bytes.
 const expected=[{sql:'238227842c05b87cea77f1e33ccfe37b866158d27a880a2f9db44a4a723d9839',postgresSql:'92cd4c2d399fddcfe1f610ba95a20d5eaaa2778370cdad9a1725ca1a3e4dd757'},
 {sql:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',postgresSql:'7f7f908335b7790fafef327197de43ea3c0257f824ba86047810b8aa5450058c'}];
 for(let i=0;i<2;i++)for(const key of ['sql','postgresSql'])assert.equal(createHash('sha256').update(migrations[i][key].replace(/\r\n/g,'\n')).digest('hex'),expected[i][key]);
 for(const name of ['customers','contacts','activities','project_customers'])assert.ok(migrations[2].postgresSql.includes(`ALTER TABLE novaworks.platform_${name} FORCE ROW LEVEL SECURITY`));
});
