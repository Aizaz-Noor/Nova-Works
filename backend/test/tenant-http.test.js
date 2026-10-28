import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';
import { seedUsers } from '../src/db/seed.js';
import { migratePlatform } from '../src/platform/migrations.js';
import { backfillDemoOrganization } from '../src/platform/backfill.js';

test('real HTTP: two companies, role boundaries, trusted sessions, CSRF, legacy separation and backend restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'novaworks-tenant-http-'));
 const path=join(directory,'persistent.sqlite');const origin='http://localhost:5173';
 let db,server,base;
 async function start(){
  db=openDatabase(path);seedUsers(db);await migratePlatform(db);await backfillDemoOrganization(db);
  server=createApp({db,erpEnabled:true,sessionSecret:'tenant-test-secret-32-characters-long-enough',production:false,frontendOrigin:origin,loginLimit:100}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
 }
 async function stop(){if(server){await new Promise(resolve=>server.close(resolve));server=null;}if(db){db.close();db=null;}}
 function client(){let cookie='';return async(path,method='GET',body,extra={})=>{
  const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  return {status:response.status,body:await response.json()};
 };}
 const call=async(client,path,method,body,status=200)=>{
  const response=await client(path,method,body);assert.equal(response.status,status,`${method||'GET'} ${path}: ${JSON.stringify(response.body)}`);return response.body;
 };
 try{
  await start();
  const alpha=client(),alphaMember=client(),beta=client(),betaManager=client(),betaMember=client();
  const password='correct-horse-battery-123';
  const register=(c,name,email)=>call(c,'/api/v1/register','POST',{name,email,password},201);
  const [a,am,b,bm,bmem]=await Promise.all([register(alpha,'Alpha Owner','owner@alpha.test'),register(alphaMember,'Alpha Member','member@alpha.test'),register(beta,'Beta Owner','owner@beta.test'),register(betaManager,'Beta Manager','manager@beta.test'),register(betaMember,'Beta Member','member@beta.test')]);
  assert.equal((await call(alpha,'/api/capabilities')).erpEnabled,true);
  assert.equal((await call(alpha,'/api/auth/me')).id,a.id);
  const context=await call(alpha,'/api/v1/context');assert.equal(context.organizationId,null);assert.deepEqual(context.organizations,[]);
  const companyA=await call(alpha,'/api/v1/organizations','POST',{name:'Alpha Digital'},201);
  const companyB=await call(beta,'/api/v1/organizations','POST',{name:'Beta Consulting'},201);
  await call(alpha,'/api/v1/organizations/select','POST',{organizationId:companyA.id});
  await call(beta,'/api/v1/organizations/select','POST',{organizationId:companyB.id});
  async function invite(owner,member,email,organization,role){
   const invitation=await call(owner,'/api/v1/invitations','POST',{email,role},201);
   await call(member,'/api/v1/invitations/accept','POST',{organizationId:organization.id,token:invitation.token});
   assert.equal((await member('/api/v1/invitations/accept','POST',{organizationId:organization.id,token:invitation.token})).status,400);
   await call(member,'/api/v1/organizations/select','POST',{organizationId:organization.id});
  }
  await invite(alpha,alphaMember,am.email,companyA,'MEMBER');await invite(beta,betaManager,bm.email,companyB,'MANAGER');await invite(beta,betaMember,bmem.email,companyB,'MEMBER');
  assert.equal((await call(alpha,'/api/v1/members')).length,2);
  assert.equal((await call(beta,'/api/v1/members')).length,3);
  const projectsA=[],projectsB=[];
  for(let i=0;i<3;i++)projectsA.push(await call(alpha,'/api/v1/projects','POST',{name:`Alpha Project ${i}`,clientName:'Alpha Client',deadline:'2027-01-30'},201));
  projectsB.push(await call(beta,'/api/v1/projects','POST',{name:'Beta Managed',managerId:bm.id},201));
  projectsB.push(await call(beta,'/api/v1/projects','POST',{name:'Beta Owner Project'},201));
  assert.equal((await call(alphaMember,'/api/v1/projects')).length,3);assert.equal((await call(betaMember,'/api/v1/projects')).length,2);
  assert.equal((await alpha('/api/v1/organizations/select','POST',{organizationId:companyB.id,role:'OWNER',userId:b.id})).status,403);
  assert.equal((await call(alpha,'/api/v1/context')).organizationId,companyA.id);
  assert.equal((await alpha(`/api/v1/projects/${projectsB[0].id}`)).status,404);
  assert.equal((await alpha(`/api/v1/projects/${projectsB[0].id}`,'PATCH',{name:'Stolen'})).status,404);
  assert.equal((await alpha('/api/v1/projects','POST',{name:'Wrong manager',managerId:bm.id})).status,400);
  assert.equal((await alphaMember('/api/v1/projects','POST',{name:'Member escalation',role:'OWNER',userId:a.id})).status,403);
  assert.equal((await alphaMember('/api/v1/invitations','POST',{email:'outsider@alpha.test',role:'ADMIN'})).status,403);
  assert.equal((await betaManager('/api/v1/invitations','POST',{email:'outsider@beta.test',role:'MEMBER'})).status,403);
  await call(betaManager,`/api/v1/projects/${projectsB[0].id}`,'PATCH',{status:'ACTIVE',version:projectsB[0].version});
  assert.equal((await betaManager(`/api/v1/projects/${projectsB[1].id}`,'PATCH',{status:'DONE'})).status,403);
  assert.equal((await betaMember(`/api/v1/projects/${projectsB[0].id}`,'PATCH',{status:'DONE'})).status,403);
  const missingProjectVersion=await alpha(`/api/v1/projects/${projectsA[0].id}`,'PATCH',{name:'Missing version'});assert.equal(missingProjectVersion.status,400);
  // Unsupported body identity fields fail without changing data or appending audit.
  const spoofedBody=await alpha(`/api/v1/projects/${projectsA[0].id}`,'PATCH',{name:'Must not save',version:projectsA[0].version,organizationId:companyB.id,userId:b.id,role:'OWNER'});
  assert.equal(spoofedBody.status,400);assert.equal(spoofedBody.body.error.code,'BAD_INPUT');
  const untouched=db.prepare('SELECT name,status,version FROM platform_projects WHERE organization_id=? AND id=?').get(companyA.id,projectsA[0].id);
  assert.deepEqual({...untouched},{name:'Alpha Project 0',status:'PLANNED',version:1});
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='project.updated' AND entity_id=?").get(projectsA[0].id).n,0);
  // Valid body with spoofed identity headers still uses the authenticated company.
  const ownedResponse=await alpha(`/api/v1/projects/${projectsA[0].id}`,'PATCH',{name:'Scoped despite spoof',version:projectsA[0].version},{'X-Organization-Id':companyB.id,'X-User-Id':b.id,'X-User-Role':'OWNER'});
  assert.equal(ownedResponse.status,200);const owned=ownedResponse.body;assert.equal(owned.organization_id,companyA.id);
  const staleProject=await alpha(`/api/v1/projects/${projectsA[0].id}`,'PATCH',{name:'Stale overwrite',status:'DONE',version:projectsA[0].version});assert.equal(staleProject.status,409);assert.equal(staleProject.body.error.code,'VERSION_CONFLICT');
  const currentProject=(await call(alpha,'/api/v1/projects')).find(project=>project.id===projectsA[0].id);assert.deepEqual([currentProject.name,currentProject.status,currentProject.version],['Scoped despite spoof','PLANNED',2]);
  assert.equal((await call(alpha,`/api/v1/projects?organizationId=${companyB.id}`)).length,3);
  assert.equal((await call(alpha,'/api/v1/projects/export')).length,3);
  assert.equal((await alphaMember('/api/v1/projects/export')).status,403);
  const stamp=new Date().toISOString();
  db.prepare('INSERT INTO platform_drafts(organization_id,id,payload,created_by,created_at) VALUES (?,?,?,?,?)').run(companyB.id,'beta-private-draft','secret',b.id,stamp);
  db.prepare('INSERT INTO platform_files(organization_id,id,name,storage_key,created_by,created_at) VALUES (?,?,?,?,?,?)').run(companyB.id,'beta-private-file','secret.pdf','secret/private/key',b.id,stamp);
  assert.equal((await alpha('/api/v1/drafts/beta-private-draft')).status,404);
  assert.equal((await alpha('/api/v1/files/beta-private-file')).status,404);
  const allowedFile=await call(beta,'/api/v1/files/beta-private-file');assert.equal(allowedFile.name,'secret.pdf');assert.equal(allowedFile.storage_key,undefined);
  for(const path of ['/api/projects','/api/tasks','/api/team'])assert.equal((await alpha(path)).status,403,`Legacy blocked: ${path}`);
  assert.equal((await alpha('/api/admin/create-from-transcript','POST',{transcript:'do not call provider'})).status,403);
  assert.equal((await alpha('/api/v1/projects','POST',{name:'Missing origin'},{Origin:''})).status,403);
  assert.equal((await alpha('/api/v1/projects','POST',{name:'Evil origin'},{Origin:'https://evil.test'})).status,403);
  assert.equal((await alpha('/api/v1/projects','POST',{name:'Wrong content'},{'Content-Type':'text/plain'})).status,415);
  // Signout removes auth; restart from the same SQLite file then log in again.
  await call(alpha,'/api/auth/logout','POST',{});assert.equal((await alpha('/api/v1/projects')).status,401);
  await stop();await start();
  await call(alpha,'/api/auth/login','POST',{email:a.email,password});
  assert.equal((await call(alpha,'/api/v1/context')).organizationId,null);
  await call(alpha,'/api/v1/organizations/select','POST',{organizationId:companyA.id});
  assert.equal((await call(alpha,'/api/v1/projects')).length,3);
  // Existing Beta browser session also survives database/backend reopening.
  assert.equal((await call(beta,'/api/v1/projects')).length,2);
  assert.equal((await call(beta,`/api/v1/projects/${projectsB[0].id}`)).status,'ACTIVE');
  assert.equal((await call(alpha,'/api/v1/members')).length,2);
  assert.equal((await call(beta,'/api/v1/members')).length,3);
 }finally{await stop();rmSync(directory,{recursive:true,force:true});}
});
