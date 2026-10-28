import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createRecoveryService} from '../src/platform/recovery.js';
import {verifyPassword,hashPassword} from '../src/services/passwords.js';
test('recovery token ledger: opaque delivery, uniform results, expiry, concurrent consume and credential binding',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const p=createPlatformService(db),u=await p.register({name:'Recovery User',email:'recover@example.test',password:'original-test-password'}),messages=[];let now=Date.now();const recovery=createRecoveryService(db,{clock:()=>now,deliver:async message=>messages.push(message)});
 try{
  assert.deepEqual(await recovery.request(u.email),await recovery.request('unknown@example.test'));assert.equal(messages.length,1);const first=messages[0].token;assert.equal(JSON.stringify(db.prepare('SELECT * FROM account_recovery_tokens').all()).includes(first),false);
  const results=await Promise.allSettled([recovery.reset(first,'recovered-test-password'),recovery.reset(first,'competing-test-password')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'INVALID_RECOVERY');assert.equal(verifyPassword('recovered-test-password',db.prepare('SELECT password_hash FROM users WHERE id=?').get(u.id).password_hash),true);
  await recovery.request(u.email);now+=30*60000;await assert.rejects(recovery.reset(messages.at(-1).token,'expired-test-password'),e=>e.code==='INVALID_RECOVERY');
  await recovery.request(u.email);db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword('changed-outside-recovery'),u.id);await assert.rejects(recovery.reset(messages.at(-1).token,'stale-test-password'),e=>e.code==='INVALID_RECOVERY');
  now+=1000;const broken=createRecoveryService(db,{clock:()=>now,deliver:async()=>{throw Error('private delivery detail');}});assert.deepEqual(await broken.request(u.email),{accepted:true});const latest=db.prepare('SELECT * FROM account_recovery_tokens ORDER BY created_at DESC').get();assert.ok(latest.consumed_at);await assert.rejects(createRecoveryService(db).request(u.email),e=>e.code==='RECOVERY_NOT_CONFIGURED');
 }finally{db.close();}
});
