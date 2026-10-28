import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createSettingsService} from '../src/platform/settings.js';
import {configureBilling} from '../src/platform/billing/policy.js';
import {readFileSync} from 'node:fs';
test('company settings: tenant scope, role checks, concurrent versions, validation and read-only enforcement',async()=>{
 const db=openDatabase(':memory:');await migratePlatform(db);const p=createPlatformService(db),s=createSettingsService(db);
 try{
  const people=[];for(const name of ['owner','member','beta'])people.push(await p.register({name,email:`${name}@settings.test`,password:'settings-test-password'}));const [owner,member,beta]=people,a=await p.createOrganization(owner.id,{name:'Alpha'}),b=await p.createOrganization(beta.id,{name:'Beta'}),invite=await p.invite(owner.id,a.id,{email:member.email,role:'MEMBER'});await p.acceptInvitation(member.id,a.id,invite.token);
  assert.equal((await s.get(owner.id,a.id)).version,0);const input={version:0,legalName:'Alpha Services',defaultCurrency:'PKR',locale:'en-PK',timezone:'Asia/Karachi'};
  await assert.rejects(s.update(member.id,a.id,input),e=>e.code==='ROLE_FORBIDDEN');await assert.rejects(s.get(beta.id,a.id),e=>e.code==='TENANT_FORBIDDEN');
  const results=await Promise.allSettled([s.update(owner.id,a.id,input),s.update(owner.id,a.id,{...input,legalName:'Concurrent name'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'VERSION_CONFLICT');
  const saved=await s.get(member.id,a.id);assert.equal(saved.defaultCurrency,'PKR');assert.equal(saved.version,1);assert.equal((await s.get(beta.id,b.id)).version,0);
  for(const patch of [{timezone:'invalid/zone'},{locale:'invalid_locale'},{defaultCurrency:'FAKE'},{legalName:'bad\nname'},{organizationId:b.id}])assert.throws(()=>s.update(owner.id,a.id,{...input,version:1,...patch}),e=>e.code==='BAD_INPUT');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='organization.settings_updated'").get().n,1);
  configureBilling(db,{enabled:true,policy:JSON.parse(readFileSync(new URL('./fixtures/subscription-policy.json',import.meta.url),'utf8'))});
  await assert.rejects(s.update(owner.id,a.id,{...input,version:1}),e=>e.code==='SUBSCRIPTION_READ_ONLY');assert.equal((await s.get(owner.id,a.id)).version,1);
 }finally{db.close();}
});
