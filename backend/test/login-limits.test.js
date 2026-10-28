import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {createRequestLimits} from '../src/services/requestLimits.js';
import {seedUsers} from '../src/db/seed.js';
import {createApp} from '../src/app.js';
const check=(limits,req)=>new Promise(resolve=>limits.login(req,{},resolve));
test('account failures persist across IPs and normalized email spellings',async()=>{
 const db=openDatabase(':memory:');try{const limits=createRequestLimits(db,{loginLimit:2});await limits.loginFailed({ip:'one',body:{email:' ADMIN@example.com '}});await limits.loginFailed({ip:'two',body:{email:'admin@example.com'}});assert.equal((await check(createRequestLimits(db,{loginLimit:2}),{ip:'three',body:{email:'Admin@example.com'}})).status,429);assert.equal(await check(limits,{ip:'three',body:{email:'other@example.com'}}),undefined);}finally{db.close();}
});
test('successful login cannot erase shared IP failures; window expires',async()=>{
 const db=openDatabase(':memory:');let time=1000;try{const limits=createRequestLimits(db,{loginLimit:2,now:()=>time});const req={ip:'shared',body:{email:'one@example.com'}};limits.loginFailed(req);limits.loginSucceeded(req);limits.loginFailed({...req,body:{email:'two@example.com'}});assert.equal((await check(limits,{ip:'shared',body:{email:'three@example.com'}})).status,429);time+=15*60*1000;assert.equal(await check(limits,req),undefined);}finally{db.close();}
});
test('HTTP repeated valid same-IP sign-ins do not consume failure budget',async()=>{
 const db=openDatabase(':memory:');seedUsers(db);const server=createApp({db,sessionSecret:'login-limits-test-secret-long-enough',loginLimit:2}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const login=password=>fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@novaworks.example',password})});
 try{for(let i=0;i<6;i++)assert.equal((await login('Demo123!')).status,200);assert.equal((await login('wrong')).status,401);assert.equal((await login('Demo123!')).status,200);assert.equal((await login('wrong')).status,401);assert.equal((await login('Demo123!')).status,429);}finally{await new Promise(r=>server.close(r));db.close();}
});
test('concurrent failed attempts cannot lose increments',async()=>{
 const db=openDatabase(':memory:');try{const limits=createRequestLimits(db,{loginLimit:10});await Promise.all(Array.from({length:20},(_,index)=>Promise.resolve().then(()=>limits.loginFailed({ip:`ip-${index}`,body:{email:'target@example.com'}}))));const row=db.prepare("SELECT count FROM request_limits WHERE bucket LIKE 'login:account:%'").get();assert.equal(row.count,20);assert.equal((await check(limits,{ip:'new-ip',body:{email:'target@example.com'}})).status,429);}finally{db.close();}
});
