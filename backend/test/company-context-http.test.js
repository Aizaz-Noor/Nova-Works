import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';

test('real HTTP: stale organization precondition rejects early and late scoped routes without writes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'novaworks-company-context-'));
 const origin='http://localhost:5173';let db,server,base;
 try{
  db=openDatabase(join(directory,'context.sqlite'));await migratePlatform(db);
  server=createApp({db,erpEnabled:true,sessionSecret:'context-test-secret-32-characters-long-enough',production:false,frontendOrigin:origin,loginLimit:100}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
  let cookie='';
  const call=async(path,method='GET',body,extra={})=>{
   const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
   const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
   return {status:response.status,body:await response.json()};
  };
  const password='correct-horse-battery-123';
  const registered=await call('/api/v1/register','POST',{name:'Context Owner',email:'context-owner@example.test',password});assert.equal(registered.status,201);
  const noSelection=await call('/api/v1/projects','GET',undefined,{'X-NovaWorks-Organization':'unselected'});assert.equal(noSelection.status,409);assert.equal(noSelection.body.error.code,'ORGANIZATION_REQUIRED');
  const companyA=(await call('/api/v1/organizations','POST',{name:'Context Alpha'})).body;
  const companyB=(await call('/api/v1/organizations','POST',{name:'Context Beta'})).body;
  const preflight=await fetch(base+'/api/v1/projects',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-novaworks-organization'}});assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/X-NovaWorks-Organization/i);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyA.id})).status,200);
  assert.equal((await call('/api/v1/context','GET',undefined,{'X-NovaWorks-Organization':'stale-context'})).status,200);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyB.id})).status,200);
  const reselection=await call('/api/v1/organizations/select','POST',{organizationId:companyA.id},{'X-NovaWorks-Organization':companyB.id});assert.equal(reselection.status,200);
  assert.equal((await call('/api/v1/context')).body.organizationId,companyA.id);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyB.id},{'X-NovaWorks-Organization':companyB.id})).status,200);
  const count=(table,org)=>db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE organization_id=?`).get(org).n;
  const before={projectsA:count('platform_projects',companyA.id),projectsB:count('platform_projects',companyB.id),auditA:count('platform_audit',companyA.id),auditB:count('platform_audit',companyB.id)};
  const staleCreate=await call('/api/v1/projects','POST',{name:'Stale A draft'},{'X-NovaWorks-Organization':companyA.id});
  assert.equal(staleCreate.status,409,`stale project create should fail before write; received ${staleCreate.status} ${JSON.stringify(staleCreate.body)}`);
  assert.equal(staleCreate.body.error.code,'COMPANY_CONTEXT_CHANGED');
  assert.deepEqual({projectsA:count('platform_projects',companyA.id),projectsB:count('platform_projects',companyB.id),auditA:count('platform_audit',companyA.id),auditB:count('platform_audit',companyB.id)},before);
  const early=await call('/api/v1/customers','GET',undefined,{'X-NovaWorks-Organization':companyA.id});assert.equal(early.status,409);assert.equal(early.body.error.code,'COMPANY_CONTEXT_CHANGED');
  const malformed=await call('/api/v1/projects','POST',{name:'Malformed header'},{'X-NovaWorks-Organization':'x'.repeat(201)});assert.equal(malformed.status,400);assert.equal(malformed.body.error.code,'BAD_ORGANIZATION_CONTEXT');
  assert.deepEqual({projectsA:count('platform_projects',companyA.id),projectsB:count('platform_projects',companyB.id),auditA:count('platform_audit',companyA.id),auditB:count('platform_audit',companyB.id)},before);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyA.id})).status,200);
  const retry=await call('/api/v1/projects','POST',{name:'Reviewed A retry'},{'X-NovaWorks-Organization':companyA.id});assert.equal(retry.status,201);assert.equal(retry.body.organization_id,companyA.id);
  assert.equal(count('platform_projects',companyA.id),before.projectsA+1);assert.equal(count('platform_projects',companyB.id),before.projectsB);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyB.id})).status,200);
  let memberCookie='';
  const memberCall=async(path,method='GET',body,extra={})=>{
   const response=await fetch(base+path,{method,headers:{...(memberCookie?{Cookie:memberCookie}:{}),Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
   const set=response.headers.get('set-cookie');if(set)memberCookie=set.split(';')[0];
   return {status:response.status,body:await response.json()};
  };
  assert.equal((await memberCall('/api/v1/register','POST',{name:'Context Member',email:'context-member@example.test',password})).status,201);
  const inviteB=await call('/api/v1/invitations','POST',{email:'context-member@example.test',role:'MEMBER'});assert.equal(inviteB.status,201);
  assert.equal((await memberCall('/api/v1/invitations/accept','POST',{organizationId:companyB.id,token:inviteB.body.token})).status,200);
  assert.equal((await memberCall('/api/v1/organizations/select','POST',{organizationId:companyB.id})).status,200);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyA.id})).status,200);
  const inviteA=await call('/api/v1/invitations','POST',{email:'context-member@example.test',role:'MEMBER'});assert.equal(inviteA.status,201);
  assert.equal((await call('/api/v1/organizations/select','POST',{organizationId:companyB.id})).status,200);
  const acceptedA=await memberCall('/api/v1/invitations/accept','POST',{organizationId:companyA.id,token:inviteA.body.token},{'X-NovaWorks-Organization':companyB.id});assert.equal(acceptedA.status,200,JSON.stringify(acceptedA.body));
  assert.equal((await call('/api/v1/projects','POST',{name:'Compatible legacy request'})).status,201);
  assert.equal((await call('/api/v1/projects','POST',{name:'Matching request'},{'X-NovaWorks-Organization':companyB.id})).status,201);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));if(db)db.close();rmSync(directory,{recursive:true,force:true});
 }
});
