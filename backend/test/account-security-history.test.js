import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createRecoveryService} from '../src/platform/recovery.js';
import {recordAccountSecurity,createAccountSecurityService} from '../src/platform/accountSecurity.js';
import {verifyPassword} from '../src/services/passwords.js';
test('security history: private minimal events and atomic rollback with recovery credentials/token',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),owner=await platform.register({name:'History Owner',email:'history@example.test',password:'original-history-password'}),other=await platform.register({name:'Other User',email:'other-history@example.test',password:'other-history-password'}),messages=[],recovery=createRecoveryService(db,{deliver:async message=>messages.push(message)}),history=createAccountSecurityService(db);
 try{
  await recovery.request(owner.email);db.exec("CREATE TRIGGER reject_security_event BEFORE INSERT ON account_security_events BEGIN SELECT RAISE(ABORT,'fixture audit failure');END;");await assert.rejects(recovery.reset(messages[0].token,'new-history-password'));assert.equal(verifyPassword('original-history-password',db.prepare('SELECT password_hash FROM users WHERE id=?').get(owner.id).password_hash),true);assert.equal(db.prepare('SELECT consumed_at FROM account_recovery_tokens').get().consumed_at,null);db.exec('DROP TRIGGER reject_security_event');
  await recovery.reset(messages[0].token,'new-history-password');const result=await history.list(owner.id);assert.equal(result.pagination.total,1);assert.equal(result.events[0].event_type,'RECOVERY_RESET');assert.deepEqual(Object.keys(result.events[0]).sort(),['event_type','id','occurred_at']);assert.equal((await history.list(other.id)).events.length,0);assert.throws(()=>db.exec("UPDATE account_security_events SET event_type='PASSWORD_CHANGED'"),/immutable/);assert.throws(()=>db.exec('DELETE FROM account_security_events'),/immutable/);assert.throws(()=>history.list(owner.id,{page:0}),e=>e.code==='BAD_INPUT');for(let i=0;i<21;i++)await platform.transaction(owner.id,null,c=>recordAccountSecurity(db,c,owner.id,'PASSWORD_CHANGED'));assert.equal((await history.list(owner.id)).events.length,20);assert.equal((await history.list(owner.id,{page:2})).events.length,2);assert.equal((await history.list(other.id)).pagination.total,0);
 }finally{db.close();}
});
