import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {aiRoutes} from '../src/routes/ai.routes.js';
import {ApiError,errorHandler} from '../src/middleware/errorHandler.js';
const db={prepare:()=>({get:()=>null,all:()=>[]})};
async function start(extract,limits){const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:'ADMIN',role:'ADMIN'};next();});app.use(aiRoutes(db,extract,limits));app.use(errorHandler);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return{submit:()=>fetch(`http://127.0.0.1:${server.address().port}/create-from-transcript`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript:'Identical fixture transcript'})}),close:()=>new Promise(r=>server.close(r))};}
test('async quota cannot allow duplicate same-transcript provider calls',async()=>{
 let quotaCalls=0,providerCalls=0,releaseQuota,entered;
 const ready=new Promise(r=>entered=r),gate=new Promise(r=>releaseQuota=r);
 const s=await start(async()=>{providerCalls++;throw new ApiError(502,'FIXTURE_PROVIDER','Fixture intentionally stops before saving');},{ai:async()=>{quotaCalls++;entered();await gate;}});
 try{const first=s.submit();await ready;const duplicate=await s.submit();assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).error.code,'SUBMISSION_IN_PROGRESS');assert.equal(quotaCalls,1);releaseQuota();assert.equal((await first).status,502);assert.equal(providerCalls,1);}finally{releaseQuota();await s.close();}
});
test('async quota rejection releases transcript lock for retry',async()=>{
 let calls=0,providerCalls=0;const s=await start(async()=>{providerCalls++;throw new ApiError(502,'FIXTURE_PROVIDER','Fixture intentionally stops before saving');},{ai:async()=>{calls++;if(calls===1)throw new ApiError(429,'RATE_LIMITED','Fixture quota denial');}});
 try{assert.equal((await s.submit()).status,429);assert.equal((await s.submit()).status,502);assert.equal(calls,2);assert.equal(providerCalls,1);}finally{await s.close();}
});

test('LF and CRLF versions of one meeting reuse the saved submission',async()=>{
 const {createApp}=await import('../src/app.js');const {openDatabase}=await import('../src/db/database.js');const {seedUsers}=await import('../src/db/seed.js');const {readFile}=await import('node:fs/promises');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/expected.json',import.meta.url),'utf8'));const database=openDatabase(':memory:');seedUsers(database);let providerCalls=0;
 const app=createApp({db:database,extract:async()=>{providerCalls++;return structuredClone(fixture);},sessionSecret:'line-ending-test-secret-at-least-32-characters',production:false});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@novaworks.example',password:'Demo123!'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const submit=transcript=>fetch(base+'/api/admin/create-from-transcript',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({transcript})});
 const lf='Meeting fixture\nFinal decisions\nThree projects';const first=await submit(lf);assert.equal(first.status,201);const initial=await first.json();
 for(const transcript of [lf.replaceAll('\n','\r\n'),lf.replaceAll('\n','\r')]){const repeated=await submit(transcript);assert.equal(repeated.status,200);const result=await repeated.json();assert.equal(result.replayed,true);assert.deepEqual(result.projects.map(p=>p.id),initial.projects.map(p=>p.id));}
 assert.equal(providerCalls,1);assert.equal(database.prepare('SELECT COUNT(*) n FROM projects').get().n,3);assert.equal(database.prepare('SELECT COUNT(*) n FROM tasks').get().n,12);
 }finally{await new Promise(r=>server.close(r));database.close();}
});
