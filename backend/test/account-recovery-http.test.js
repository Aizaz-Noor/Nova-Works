import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createApp} from '../src/app.js';
test('recovery HTTP: private delivery, uniform request, CSRF, concurrent single use, revoked sessions and independent limits',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const messages=[],origin='http://127.0.0.1:5173',server=createApp({db,erpEnabled:true,recoveryOptions:{deliver:async message=>messages.push(message)},frontendOrigin:origin,sessionSecret:'account-recovery-local-test-secret-only',production:false}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 function client(){let cookie='';return async(path,method='GET',body,trusted=true)=>{const r=await fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...(trusted?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,body:await r.json()};};}
 const a=client(),b=client(),email='recover-http@example.test',password='original-http-password',newPassword='recovered-http-password',request='/api/v1/account/recovery/request',reset='/api/v1/account/recovery/reset';
 try{
  assert.equal((await a('/api/v1/register','POST',{name:'Recovery User',email,password})).status,201);assert.equal((await b('/api/auth/login','POST',{email,password})).status,200);
  assert.equal((await a(request,'POST',{email},false)).status,403);const known=await a(request,'POST',{email}),unknown=await a(request,'POST',{email:'unknown@example.test'});assert.deepEqual(known,unknown);assert.equal(known.status,202);assert.deepEqual(known.body,{accepted:true});assert.equal(messages.length,1);
  const token=messages[0].token,replies=await Promise.all([a(reset,'POST',{token,newPassword}),b(reset,'POST',{token,newPassword})]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);assert.equal((await a('/api/auth/me')).status,401);assert.equal((await b('/api/auth/me')).status,401);assert.equal((await a('/api/auth/login','POST',{email,password})).status,401);assert.equal((await a('/api/auth/login','POST',{email,password:newPassword})).status,200);
  assert.equal((await a(reset,'POST',{token,newPassword})).status,400);await a(request,'POST',{email});await a(request,'POST',{email});assert.equal((await a(request,'POST',{email})).status,429);for(let n=0;n<2;n++)await a(request,'POST',{email:'unknown@example.test'});assert.equal((await a(request,'POST',{email:'unknown@example.test'})).status,429);
 }finally{await new Promise(r=>server.close(r));db.close();}
});
