// Disposable loopback database only; no hosted DATABASE_URL or human-testing data.
import pg from '../backend/node_modules/pg/lib/index.js';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {createPlatformService} from '../backend/src/platform/service.js';
const password=(await readFile('E:/Projects/Hackathon/tmp/novaworks-analysis-20261019/tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},stamp=Date.now(),database=`nw_member_grants_${stamp}`,role=`nw_mg_rt_${stamp}`;
const control=new pg.Client({...config,database:'postgres'});await control.connect();try{await control.query(`CREATE DATABASE ${database}`);}finally{await control.end();}
await mkdir('tmp',{recursive:true});const folder=await mkdtemp(resolve('tmp/membership-grants-pg-')),evidence={result:'FAIL',database};const admin=new pg.Pool({...config,database});let runtime;
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword='local-membership-'+randomUUID();await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 const p=createPlatformService(db),accountPassword='membership-fixture-password',make=name=>p.register({name,email:`${name}@membership-grants.test`,password:accountPassword}),owner=await make('Owner'),member=await make('Member'),other=await make('Other'),org=await p.createOrganization(owner.id,{name:'Alpha'}),beta=await p.createOrganization(other.id,{name:'Beta'}),invite=await p.invite(owner.id,org.id,{email:member.email,role:'MEMBER'});await p.acceptInvitation(member.id,org.id,invite.token);assert.equal((await p.selectOrganization(member.id,org.id)).role,'MEMBER');
 await assert.rejects(p.transaction(member.id,org.id,c=>c.query("UPDATE novaworks.platform_memberships SET role='OWNER' WHERE organization_id=? AND user_id=?",[org.id,member.id])),error=>error.code==='42501');await assert.rejects(p.transaction(owner.id,org.id,c=>c.query('DELETE FROM novaworks.platform_memberships WHERE organization_id=? AND user_id=?',[org.id,member.id])),error=>error.code==='42501');assert.equal((await p.listMembers(owner.id,org.id)).find(x=>x.user_id===member.id).role,'MEMBER');
 const project=await p.createProject(owner.id,org.id,{name:'Still works'});assert.equal((await p.listProjects(member.id,org.id))[0].id,project.id);await assert.rejects(p.listMembers(member.id,beta.id),error=>error.status===403);assert.equal((await db.query('SELECT * FROM novaworks.platform_memberships')).rows.length,0);
 await admin.query(`GRANT UPDATE(role) ON novaworks.platform_memberships TO ${role}`);await assert.rejects(assertPlatformRuntimeRole(db),/memberships/);await admin.query(provision);await assertPlatformRuntimeRole(db);assert.equal((await p.listOrganizations(member.id)).length,1);
 evidence.result='PASS';evidence.checks=['fresh restricted runtime onboarding/company/invite/accept/read works','raw member self-promotion UPDATE42501 and membership DELETE42501; original role preserved','company project reads continue; foreigncompany403/no-context zero rows','startup rejects accidentally reintroduced column UPDATE privilege; reprovision removes it'];
}catch(error){evidence.error=error.message;throw error;}
finally{await runtime?.end();await admin.end();await writeFile(join(folder,'results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({folder,...evidence},null,2));}
