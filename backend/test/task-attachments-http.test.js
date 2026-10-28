import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createPrivateFileStorage} from '../src/modules/files/privateStorage.js';
import {createApp} from '../src/app.js';

test('private attachment HTTP: actual bytes, bounded envelope, CSRF and withdrawn access',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'nw-attachment-http-')),db=openDatabase(':memory:');await migratePlatform(db);
 const platform=createPlatformService(db),password='private-attachment-http-password',owner=await platform.register({name:'Owner',email:'owner@attachment-http.test',password}),member=await platform.register({name:'Member',email:'member@attachment-http.test',password}),peer=await platform.register({name:'Peer',email:'peer@attachment-http.test',password}),org=await platform.createOrganization(owner.id,{name:'Private delivery'});
 for(const user of [member,peer]){const invitation=await platform.invite(owner.id,org.id,{email:user.email,role:'MEMBER'});await platform.acceptInvitation(user.id,org.id,invitation.token);}
 const tasks=createTaskService(db),project=await platform.createProject(owner.id,org.id,{name:'Delivery'}),task=await tasks.create(owner.id,org.id,{projectId:project.id,title:'Private review',description:'Review',assigneeId:member.id,deadline:'2027-01-01',estimatedHours:1});
 const storage=await createPrivateFileStorage({root:join(folder,'private')}),origin='http://localhost:5173',server=createApp({db,erpEnabled:true,attachmentOptions:{storage},sessionSecret:'attachment-http-session-fixture-secret32',frontendOrigin:origin}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 async function login(user){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password})});assert.equal(response.status,200);const Cookie=response.headers.get('set-cookie').split(';')[0];const headers={Origin:origin,'Content-Type':'application/json',Cookie};assert.equal((await fetch(base+'/api/v1/organizations/select',{method:'POST',headers,body:JSON.stringify({organizationId:org.id})})).status,200);return headers;}
 try{
  const memberHeaders=await login(member),peerHeaders=await login(peer),path=`/api/v1/tasks/${task.id}/attachments`,bytes=Buffer.alloc(300*1024,65),input={requestId:randomUUID(),name:'delivery.txt',contentBase64:bytes.toString('base64')};
  const upload=await fetch(base+path,{method:'POST',headers:memberHeaders,body:JSON.stringify(input)});assert.equal(upload.status,201);const saved=await upload.json();assert.equal(saved.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal((await fetch(base+path,{method:'POST',headers:memberHeaders,body:JSON.stringify(input)})).status,200);
  assert.equal((await fetch(base+path,{method:'POST',headers:memberHeaders,body:JSON.stringify({...input,name:'changed.txt'})})).status,409);
  const downloadPath=`${path}/${saved.id}/download`,download=await fetch(base+downloadPath,{headers:memberHeaders});assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  assert.equal((await fetch(base+path,{headers:peerHeaders})).status,404);assert.equal((await fetch(base+downloadPath,{headers:peerHeaders})).status,404);assert.equal((await fetch(base+downloadPath)).status,401);
  assert.equal((await fetch(base+path,{method:'POST',headers:{...memberHeaders,Origin:'http://evil.test'},body:JSON.stringify(input)})).status,403);
  const {Origin,...noOrigin}=memberHeaders;assert.equal((await fetch(base+path,{method:'POST',headers:noOrigin,body:JSON.stringify(input)})).status,403);
  assert.equal((await fetch(base+'/api/v1/projects',{method:'POST',headers:memberHeaders,body:JSON.stringify({name:'x'.repeat(300*1024)})})).status,413);
  assert.equal((await fetch(base+path,{method:'POST',headers:memberHeaders,body:JSON.stringify({...input,requestId:randomUUID(),contentBase64:'A'.repeat(4*1024*1024)})})).status,413);
  await tasks.update(owner.id,org.id,task.id,{assigneeId:peer.id,version:task.version});assert.equal((await fetch(base+downloadPath,{headers:memberHeaders})).status,404);assert.equal((await fetch(base+downloadPath,{headers:peerHeaders})).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
