import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createRecoveryService} from '../src/platform/recovery.js';
import {createRecoveryRetention} from '../src/platform/recoveryRetention.js';
test('recovery retention previews by default, bounds deletion and preserves recent tokens and users',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const user=await createPlatformService(db).register({name:'Retention User',email:'retention@example.test',password:'retention-test-password'});let now=Date.now();const messages=[],recovery=createRecoveryService(db,{clock:()=>now,deliver:async value=>messages.push(value)}),retention=createRecoveryRetention(db,{clock:()=>now});
 try{for(let i=0;i<3;i++)await recovery.request(user.email);now+=8*86400000;await recovery.request(user.email);assert.equal((await retention.run()).eligibleInBatch,3);assert.equal(db.prepare('SELECT COUNT(*) n FROM account_recovery_tokens').get().n,4);assert.equal((await retention.run({mode:'APPLY',batchSize:2})).deleted,2);assert.equal((await retention.run({mode:'APPLY',batchSize:2})).deleted,1);assert.equal((await retention.run({mode:'APPLY'})).deleted,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,1);assert.deepEqual(await recovery.reset(messages.at(-1).token,'after-retention-password'),{success:true,signInRequired:true});await assert.rejects(retention.run({mode:'APPLY',retentionDays:0}));}finally{db.close();}
});
