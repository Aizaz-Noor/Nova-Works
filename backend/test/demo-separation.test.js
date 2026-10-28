import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { seedUsers } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { migratePlatform } from '../src/platform/migrations.js';
import { createPlatformService } from '../src/platform/service.js';
import { teamDirectory } from '../src/services/projectService.js';
import { paginatedList } from '../src/services/pagination.js';

test('public demo directory and AI input exclude commercial identities',async()=>{
 const db=openDatabase(':memory:');seedUsers(db);await migratePlatform(db);
 try{
  const privateUser=await createPlatformService(db).register({name:'Private Commercial Person',email:'private@example.test',password:'private-test-password-only'});
  const directory=await teamDirectory(db);assert.equal(directory.length,10);assert.ok(!directory.some(person=>person.id===privateUser.id));
  const list=await paginatedList(db,{id:'ADMIN',role:'ADMIN'},'team');assert.equal(list.pagination.total,10);assert.ok(!list.team.some(person=>person.id===privateUser.id));
  assert.equal((await paginatedList(db,{id:'ADMIN',role:'ADMIN'},'team',{q:'Private Commercial'})).pagination.total,0);
  let providerDirectory;const app=createApp({db,sessionSecret:'demo-separation-test-secret-long-enough',extract:async(_input,people)=>{providerDirectory=people;return{projects:[]};}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{
   const base=`http://127.0.0.1:${server.address().port}`;
   const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@novaworks.example',password:'Demo123!'})});
   const cookie=login.headers.get('set-cookie').split(';')[0];
   const response=await fetch(base+'/api/admin/extract-transcript',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({transcript:'Fictional demo meeting'})});assert.equal(response.status,200);assert.equal(providerDirectory.length,10);assert.ok(!providerDirectory.some(person=>person.id===privateUser.id));
   const preflight=await fetch(base+'/api/v1/projects/example',{method:'OPTIONS',headers:{Origin:'http://localhost:5173','Access-Control-Request-Method':'PATCH'}});assert.equal(preflight.status,204);assert.ok(preflight.headers.get('access-control-allow-methods').includes('PATCH'));
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{db.close();}
});
