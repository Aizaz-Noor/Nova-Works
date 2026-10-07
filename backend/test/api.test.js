import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';
import { seedUsers } from '../src/db/seed.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expected.json',import.meta.url)));
const secret='test-only-session-secret-32-characters-minimum';
async function start(extract) {
 const db=openDatabase(':memory:');seedUsers(db);
 const app=createApp({db,extract,sessionSecret:secret,production:false});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 function client(){let cookie='';return async(path,method='GET',body)=>{
  const res=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:res.status,body:await res.json()};
 };}
 return {db,base,client,close:async()=>{await new Promise(resolve=>server.close(resolve));db.close();}};
}
async function login(client,email){const r=await client('/api/auth/login','POST',{email:`${email}@novaworks.example`,password:'Demo123!'});assert.equal(r.status,200);assert.equal(r.body.password_hash,undefined);return r;}
test('HTTP login, session, RBAC, direct access, errors, deduplication and logout',async()=>{
 let calls=0;const s=await start(async()=>{calls++;return structuredClone(fixture);});
 try {
  const admin=s.client(),ayesha=s.client(),ali=s.client(),hamza=s.client();
  assert.equal((await admin('/api/projects')).status,401);
  assert.equal((await admin('/api/auth/login','POST',{email:'admin@novaworks.example',password:'wrong'})).status,401);
  await login(admin,'admin');assert.equal((await admin('/api/auth/me')).body.role,'ADMIN');
  assert.equal((await admin('/api/admin/create-from-transcript','POST',{transcript:' '})).status,400);
  const generated=await admin('/api/admin/create-from-transcript','POST',{transcript:'Test fixture provider only'});
  assert.equal(generated.status,201);assert.equal(generated.body.projectCount,3);assert.equal(generated.body.taskCount,12);
  assert.equal((await admin('/api/projects')).body.projects.length,3);
  const repeat=await admin('/api/admin/create-from-transcript','POST',{transcript:'Test fixture provider only'});assert.equal(repeat.status,200);assert.equal(repeat.body.replayed,true);assert.equal(calls,1);
  await login(ayesha,'ayesha');await login(ali,'ali');await login(hamza,'hamza');
  assert.deepEqual((await ayesha('/api/projects')).body.projects.map(p=>p.name),['UrbanCart Website']);
  assert.equal((await ali('/api/tasks?userId=DEV02&role=ADMIN')).body.tasks.length,3);
  assert.equal((await hamza('/api/tasks')).body.tasks.length,2);
  const [urban,quick]=generated.body.projects;
  assert.equal((await ali(`/api/projects/${urban.id}`)).body.tasks.length,3);
  assert.equal((await ali(`/api/projects/${quick.id}`)).status,404);assert.equal((await ayesha(`/api/projects/${quick.id}`)).status,404);
  for(const client of [ayesha,ali,hamza])assert.equal((await client('/api/admin/create-from-transcript','POST',{transcript:'x',role:'ADMIN',userId:'ADMIN'})).status,403);
  assert.equal((await admin('/api/team')).body.team.length,10);
  const originDenied=await fetch(s.base+'/api/auth/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(originDenied.status,403);
  const malformed=await fetch(s.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).error.code,'BAD_JSON');
  await admin('/api/auth/logout','POST');assert.equal((await admin('/api/auth/me')).status,401);
 }finally{await s.close();}
});
test('invalid AI output persists zero records and permits corrected retry',async()=>{
 let invalid=true;const s=await start(async()=>{const result=structuredClone(fixture);if(invalid)result.projects[2].tasks[3].assigneeId='Kamran';return result;});
 try {const admin=s.client();await login(admin,'admin');const r=await admin('/api/admin/create-from-transcript','POST',{transcript:'bad'});assert.equal(r.status,422);assert.ok(r.body.error.issues.length);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM projects').get().n,0);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tasks').get().n,0);invalid=false;assert.equal((await admin('/api/admin/create-from-transcript','POST',{transcript:'bad'})).status,201);}
 finally{await s.close();}
});
test('concurrent duplicate submission rejected while processing',async()=>{
 let release,entered;const ready=new Promise(r=>entered=r);const wait=new Promise(r=>release=r);
 const s=await start(async()=>{entered();await wait;return structuredClone(fixture);});
 try {const a=s.client(),b=s.client();await login(a,'admin');await login(b,'admin');const pending=a('/api/admin/create-from-transcript','POST',{transcript:'same'});await ready;assert.equal((await b('/api/admin/create-from-transcript','POST',{transcript:'same'})).status,409);release();assert.equal((await pending).status,201);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM projects').get().n,3);}
 finally{release();await s.close();}
});
