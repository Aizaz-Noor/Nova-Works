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
