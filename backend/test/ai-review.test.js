import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
import {openDatabase} from '../src/db/database.js';
import {seedUsers} from '../src/db/seed.js';
import {initializeDrafts,claimExtraction,finishExtraction,failClaim} from '../src/services/aiDrafts.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expected.json',import.meta.url)));
async function server(db,extract){
 const app=createApp({db,extract,sessionSecret:'review-test-secret-at-least-thirty-two-characters',production:false});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let cookie='';
 const call=async(path,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};};
 assert.equal((await call('/auth/login','POST',{email:'admin@novaworks.example',password:'Demo123!'})).status,200);
 return {call,close:()=>new Promise(r=>server.close(r))};
}
test('two API instances share extraction claim; review corrects output before atomic approval and replay',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'novaworks-review-'));const db=openDatabase(join(dir,'db.sqlite'));seedUsers(db);const other=openDatabase(join(dir,'db.sqlite'));
 let entered,release,calls=0;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
 const extract=async()=>{calls++;entered();await wait;const draft=structuredClone(fixture);draft.projects[0].managerId='missing';return draft;};
 const a=await server(db,extract),b=await server(other,extract);
 try{
  const pending=a.call('/admin/extract-transcript','POST',{transcript:'A real meeting to review'});await ready;
  assert.equal((await b.call('/admin/extract-transcript','POST',{transcript:'A real meeting to review'})).status,409);assert.equal(calls,1);release();
  const extracted=await pending;assert.equal(extracted.status,200);assert.equal(extracted.body.status,'review');assert.ok(extracted.body.issues.length);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n,0);
  const url=`/admin/ai-drafts/${extracted.body.draftId}`;assert.equal((await b.call(url)).status,200);
  assert.equal((await b.call(url+'/approve','POST',{})).status,422);assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n,0);
  const corrected=structuredClone(fixture);corrected.projects[0].name='Human corrected project';
  const saved=await b.call(url+'/approve','POST',{draft:corrected});assert.equal(saved.status,201);assert.equal(saved.body.projects[0].name,'Human corrected project');
  assert.equal((await a.call(url+'/approve','POST',{draft:fixture})).body.replayed,true);assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n,3);assert.equal(calls,1);
 }finally{release();await a.close();await b.close();db.close();other.close();rmSync(dir,{recursive:true,force:true});}
});
test('expired and failed extraction leases recover; stale workers cannot persist a draft',async()=>{
 const db=openDatabase(':memory:');initializeDrafts(db);
 try{
  const expired=await claimExtraction(db,'expired',{now:Date.now()-5000,leaseMs:1});
  const recovered=await claimExtraction(db,'expired');assert.equal(recovered.id,expired.id);assert.notEqual(recovered.token,expired.token);
  await assert.rejects(finishExtraction(db,expired.id,expired.token,fixture),e=>e.code==='LEASE_EXPIRED');
  await finishExtraction(db,recovered.id,recovered.token,fixture);
  const failed=await claimExtraction(db,'failed');await failClaim(db,failed.id,failed.token);assert.equal((await claimExtraction(db,'failed')).owned,true);
 }finally{db.close();}
});
test('extraction caps reject oversized input and total task count',async()=>{
 const db=openDatabase(':memory:');seedUsers(db);let calls=0;const app=await server(db,async()=>{calls++;return fixture;});
 try{assert.equal((await app.call('/admin/extract-transcript','POST',{transcript:'x'.repeat(30001)})).status,400);assert.equal(calls,0);
 const result=await app.call('/admin/extract-transcript','POST',{transcript:'Within limits'});const draft=structuredClone(fixture);draft.projects[0].tasks=Array.from({length:100},()=>structuredClone(fixture.projects[0].tasks[0]));assert.equal((await app.call(`/admin/ai-drafts/${result.body.draftId}/approve`,'POST',{draft})).status,422);assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n,0);
 }finally{await app.close();db.close();}
});
