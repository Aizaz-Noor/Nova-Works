// Disposable loopback-only fixture. Never reads hosted DATABASE_URL or human testing DB.
import pg from '../backend/node_modules/pg/lib/index.js';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {migratePlatform,migrations} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createMemberAdministration} from '../backend/src/platform/memberAdministration.js';
import {configureBilling} from '../backend/src/platform/billing/policy.js';
const password=(await readFile('E:/Projects/Hackathon/tmp/novaworks-analysis-20261019/tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},stamp=Date.now(),database=`nw_member_lifecycle_${stamp}`,role=`nw_ml_rt_${stamp}`;
const migrationOrdinal=version=>Number(/^\d+/.exec(version)?.[0]);
const control=new pg.Client({...config,database:'postgres'});await control.connect();try{await control.query(`CREATE DATABASE ${database}`);}finally{await control.end();}
await mkdir('tmp',{recursive:true});const folder=await mkdtemp(resolve('tmp/member-lifecycle-pg-')),evidence={result:'FAIL',database};const admin=new pg.Pool({...config,database});let runtime;
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));
 // Reconstruct checksummed023 and populate historical identities/project before forward024.
 await admin.query('CREATE TABLE novaworks.platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');
 for(const migration of migrations.filter(x=>migrationOrdinal(x.version)<24)){await admin.query(migration.postgresSql);await admin.query('INSERT INTO novaworks.platform_migrations VALUES($1,$2,$3)',[migration.version,createHash('sha256').update(migration.postgresSql).digest('hex'),new Date().toISOString()]);}
 await admin.query("INSERT INTO novaworks.users VALUES('old-owner','Historical owner','old@member.test','fixture','AGENT','','[]');INSERT INTO novaworks.platform_organizations VALUES('old-company','Historical company','old-owner','old-created');INSERT INTO novaworks.platform_memberships VALUES('old-company','old-owner','OWNER','old-created');INSERT INTO novaworks.platform_projects(organization_id,id,name,manager_id,created_at) VALUES('old-company','old-project','Historical project','old-owner','old-created')");
 const before=(await admin.query("SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version")).rows;
 await migratePlatform(adapter(admin));
 assert.deepEqual((await admin.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows.filter(row=>migrationOrdinal(row.version)<24),before);
 assert.deepEqual((await admin.query("SELECT role,status,version,created_at,updated_at FROM novaworks.platform_memberships WHERE user_id='old-owner'")).rows[0],{role:'OWNER',status:'ACTIVE',version:1,created_at:'old-created',updated_at:'old-created'});
 assert.equal((await admin.query("SELECT name FROM novaworks.platform_projects WHERE id='old-project'")).rows[0].name,'Historical project');assert.equal((await admin.query("SELECT status FROM novaworks.platform_member_access WHERE user_id='old-owner'")).rows[0].status,'ACTIVE');
 let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword='local-membership-'+randomUUID();await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 const p=createPlatformService(db),members=createMemberAdministration(db),make=name=>p.register({name,email:`${name}@member-lifecycle.test`,password:'membership-fixture-password'}),owner=await make('Owner'),member=await make('Member'),other=await make('Other'),administrator=await make('Administrator'),org=await p.createOrganization(owner.id,{name:'Alpha'}),beta=await p.createOrganization(other.id,{name:'Beta'});
 const add=async(person,target,by,role)=>p.acceptInvitation(person.id,target.id,(await p.invite(by.id,target.id,{email:person.email,role})).token);
 await add(member,org,owner,'MEMBER');await add(member,beta,other,'MEMBER');await add(administrator,org,owner,'ADMIN');
 const project=await p.createProject(owner.id,org.id,{name:'Historical Alpha'}),betaProject=await p.createProject(other.id,beta.id,{name:'Beta'});
 const proposal={version:1,role:'MEMBER',status:'SUSPENDED'};
 await assert.rejects(members.transition(owner.id,org.id,owner.id,{version:1,role:'ADMIN',status:'ACTIVE'}),e=>e.status===403);
 await assert.rejects(members.transition(administrator.id,org.id,member.id,{version:1,role:'ADMIN',status:'ACTIVE'}),e=>e.status===403);
 const contenders=await Promise.allSettled([members.transition(owner.id,org.id,member.id,proposal),members.transition(administrator.id,org.id,member.id,proposal)]);
 assert.equal(contenders.filter(x=>x.status==='fulfilled').length,1);assert.equal(contenders.filter(x=>x.status==='rejected'&&x.reason.code==='VERSION_CONFLICT').length,1);
 await assert.rejects(p.listProjects(member.id,org.id),e=>e.code==='MEMBERSHIP_SUSPENDED');assert.equal((await p.listProjects(member.id,beta.id))[0].id,betaProject.id);assert.equal((await p.listOrganizations(member.id)).length,1);
 const raw=async(user,company,work)=>adapter(runtime).transaction(async c=>{await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[user,company]);return work(c);});
 assert.equal((await raw(member.id,org.id,c=>c.query('SELECT * FROM novaworks.platform_projects'))).rows.length,0);
 await assert.rejects(raw(member.id,org.id,c=>c.query('INSERT INTO novaworks.platform_tasks(organization_id,id,project_id,title,assignee_id,created_at) VALUES($1,$2,$3,$4,$5,$6)',[org.id,randomUUID(),project.id,'Denied',member.id,'now'])),e=>e.code==='42501');
 await assert.rejects(raw(owner.id,org.id,c=>c.query("UPDATE novaworks.platform_memberships SET role='OWNER' WHERE user_id=$1",[member.id])),e=>e.code==='42501');
 await assert.rejects(raw(member.id,org.id,c=>c.query("SELECT * FROM novaworks.transition_company_member($1,1,'MEMBER','SUSPENDED',$2,'now')",[administrator.id,randomUUID()])),e=>e.message==='MEMBER_FORBIDDEN');
 assert.equal((await db.query('SELECT * FROM novaworks.platform_projects')).rows.length,0);
 const changed=await members.transition(owner.id,org.id,member.id,{version:2,role:'MANAGER',status:'ACTIVE'});assert.equal(changed.member.version,3);assert.equal((await p.listProjects(member.id,org.id))[0].id,project.id);
 const audits=await admin.query("SELECT * FROM novaworks.platform_audit WHERE organization_id=$1 AND action LIKE 'MEMBER_TRANSITION:%'",[org.id]);assert.equal(audits.rows.length,2);
 // Audit failure must roll the membership and access mirror back in one transaction.
 await assert.rejects(raw(owner.id,org.id,c=>c.query("SELECT * FROM novaworks.transition_company_member($1,3,'MEMBER','SUSPENDED',$2,'now')",[member.id,audits.rows[0].id])),e=>e.code==='23505');
 assert.equal((await members.list(owner.id,org.id)).members.find(x=>x.user_id===member.id).version,3);assert.equal((await p.listProjects(member.id,org.id))[0].id,project.id);
 // Hold an actual earlier company request, then verify revocation waits for its fence.
 let release,entered;const ready=new Promise(r=>entered=r),held=p.transaction(member.id,org.id,async()=>{entered();await new Promise(r=>release=r);});await ready;
 let finished=false;const pending=members.transition(owner.id,org.id,member.id,{version:3,role:'MANAGER',status:'SUSPENDED'}).then(value=>{finished=true;return value;});
 await new Promise(r=>setTimeout(r,150));assert.equal(finished,false);release();await held;await pending;
 // Configured business read-only still permits bounded member security maintenance.
 const policy={trialDays:1,graceDays:0,initialPlan:'TEST',pricePlans:{},plans:{TEST:{seats:20,aiDaily:1,features:Object.fromEntries(['crm','projects','sales','timesheets','invoicing','ai','reports'].map(k=>[k,true]))}}};configureBilling(db,{enabled:true,policy});
 await assert.rejects(p.createProject(owner.id,org.id,{name:'Blocked unconfigured billing'}),e=>e.status===402);
 await members.transition(owner.id,org.id,member.id,{version:4,role:'MANAGER',status:'ACTIVE'});
 assert.equal((await p.listProjects(member.id,org.id))[0].id,project.id);
 const guard=(await admin.query("SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='novaworks_member_lifecycle_guard'")).rows[0];assert.ok(Object.values(guard).every(x=>x===false));
 evidence.result='PASS';evidence.restrictiveTables=Number((await admin.query("SELECT count(*) FROM pg_policies WHERE policyname='member_access_gate'")).rows[0].count);evidence.checks=['fresh024 migration and restricted runtime onboarding/invitation/project flow','owner/admin/self guards, concurrent CAS exactly one success','suspended request403 and rawRLS read/write denial, othercompany unaffected','raw runtime cannot UPDATE memberships; suspended definer call denied','reactivation retains historical project and member rows','audit failure atomically rolls back membership and access mirror','exclusive revocation waits for prior shared company request','business read-only rejects project write but allows member security maintenance','NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS function owner'];
}catch(error){evidence.error=error.message;throw error;}
finally{await runtime?.end();await admin.end();await writeFile(join(folder,'results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({folder,...evidence},null,2));}
