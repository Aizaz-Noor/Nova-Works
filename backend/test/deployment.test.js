import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDatabase } from '../src/db/database.js';
import { seedUsers } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { createRequestLimits } from '../src/services/requestLimits.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expected.json',import.meta.url)));
async function withServer(options,work){const db=openDatabase(':memory:');seedUsers(db);const app=createApp({db,sessionSecret:'post-hackathon-security-test-secret-long-enough',...options});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;try{await work(base,db);}finally{await new Promise(r=>server.close(r));db.close();}}
const post=(base,path,body,cookie='')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
test('HTTP paid-AI quota blocks new calls but identical saved transcript remains usable',async()=>{
 let calls=0;await withServer({aiDailyLimit:1,extract:async()=>{calls++;return structuredClone(fixture);}},async base=>{
  const login=await post(base,'/api/auth/login',{email:'admin@novaworks.example',password:'Demo123!'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await post(base,'/api/admin/create-from-transcript',{transcript:'first'},cookie)).status,201);
  assert.equal((await post(base,'/api/admin/create-from-transcript',{transcript:'first'},cookie)).status,200);
  const blocked=await post(base,'/api/admin/create-from-transcript',{transcript:'second'},cookie);assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);assert.equal(calls,1);
  assert.equal((await (await fetch(base+'/api/projects',{headers:{Cookie:cookie}})).json()).projects.length,3);
 });
});
test('HTTP login throttling rejects repeated guesses before authentication',async()=>{
 await withServer({loginLimit:2},async base=>{for(let i=0;i<2;i++)assert.equal((await post(base,'/api/auth/login',{email:'admin@novaworks.example',password:'wrong'})).status,401);const blocked=await post(base,'/api/auth/login',{email:'admin@novaworks.example',password:'Demo123!'});assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);});
});
test('quotas survive limiter recreation and reopen after their window',()=>{
 const db=openDatabase(':memory:');let clock=Date.parse('2026-10-08T12:00:00Z');try{let limiter=createRequestLimits(db,{aiDailyLimit:1,now:()=>clock});limiter.ai();limiter=createRequestLimits(db,{aiDailyLimit:1,now:()=>clock});assert.throws(()=>limiter.ai(),e=>e.status===429);clock+=24*60*60*1000;assert.doesNotThrow(()=>limiter.ai());}finally{db.close();}
});
test('production responses include restrictive browser headers and API no-store',async()=>{
 await withServer({production:true},async base=>{const response=await fetch(base+'/api/health');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-frame-options'),'DENY');assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.equal(response.headers.get('x-powered-by'),null);});
});
