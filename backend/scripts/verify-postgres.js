import '../src/config.js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openConfiguredDatabase} from '../src/db/database.js';
import {seedUsers} from '../src/db/seed.js';
import {teamDirectory,saveDraft,listProjects,listTasks,getProject,previousSubmission} from '../src/services/projectService.js';
import {validateAiOutput} from '../src/validators/aiOutput.js';
import {PostgresSessionStore} from '../src/services/postgresSessionStore.js';
import {createPostgresLimits} from '../src/services/postgresRequestLimits.js';
if(!process.env.DATABASE_URL){console.error('BLOCKED: configure private server DATABASE_URL before PostgreSQL acceptance');process.exit(1);}
let db;const marker=`pg-acceptance-${randomUUID()}`;const badMarker=marker+'-rollback';const sid=marker+'-session';const ids=[];
const call=(store,method,...args)=>new Promise((resolve,reject)=>store[method](...args,(error,value)=>error?reject(error):resolve(value)));
try{
 db=await openConfiguredDatabase();assert.equal(db.kind,'postgres');assert.equal(await seedUsers(db),10);assert.equal(await seedUsers(db),10);
 const directory=await teamDirectory(db);assert.ok(directory.every(u=>Array.isArray(u.skills)&&!u.password_hash));
 const fixture=JSON.parse(await readFile(new URL('../test/fixtures/expected.json',import.meta.url),'utf8'));
 const draft=validateAiOutput(fixture,directory);
 const [first,second]=await Promise.all([saveDraft(db,draft,marker),saveDraft(db,draft,marker)]);assert.equal(Number(first.replayed)+Number(second.replayed),1);ids.push(...first.projects.map(p=>p.id));assert.equal(first.taskCount,12);assert.ok(first.projects.every(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.deadline)));
 const admin={role:'ADMIN',id:'ADMIN'},ayesha={role:'MANAGER',id:'PM01'},ali={role:'AGENT',id:'DEV01'},hamza={role:'AGENT',id:'DEV02'};
 const urban=first.projects.find(p=>p.managerId==='PM01');const quick=first.projects.find(p=>p.managerId==='PM02');
 assert.equal((await getProject(db,ali,urban.id)).tasks.length,3);assert.equal((await getProject(db,hamza,urban.id)).tasks.length,1);await assert.rejects(getProject(db,ali,quick.id),e=>e.status===404);await assert.rejects(getProject(db,ayesha,quick.id),e=>e.status===404);
 assert.equal((await listProjects(db,ayesha)).filter(p=>ids.includes(p.id)).length,1);assert.equal((await listTasks(db,admin)).filter(t=>ids.includes(t.projectId)).length,12);
 const beforeCounts=(await db.query('SELECT (SELECT COUNT(*) FROM novaworks.projects)::int AS projects,(SELECT COUNT(*) FROM novaworks.tasks)::int AS tasks')).rows[0];const broken=structuredClone(draft);broken.projects[2].tasks[3].assigneeId='missing';await assert.rejects(saveDraft(db,broken,badMarker));assert.equal(await previousSubmission(db,badMarker),null);assert.deepEqual((await db.query('SELECT (SELECT COUNT(*) FROM novaworks.projects)::int AS projects,(SELECT COUNT(*) FROM novaworks.tasks)::int AS tasks')).rows[0],beforeCounts);
 const store=new PostgresSessionStore(db);await call(store,'set',sid,{userId:'ADMIN',cookie:{maxAge:60000}});assert.equal((await call(store,'get',sid)).userId,'ADMIN');await db.close();db=await openConfiguredDatabase();assert.equal((await previousSubmission(db,marker)).taskCount,12);assert.equal((await call(new PostgresSessionStore(db),'get',sid)).userId,'ADMIN');
 const quotaTime=Date.UTC(2099,0,1)+Math.floor(Math.random()*100000000);const day=new Date(quotaTime).toISOString().slice(0,10);const quota=createPostgresLimits(db,{aiDailyLimit:2,now:()=>quotaTime});await db.query('DELETE FROM novaworks.request_limits WHERE bucket=$1',[`ai:${day}`]);const attempts=await Promise.allSettled(Array.from({length:8},()=>quota.ai()));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2);assert.ok(attempts.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));await db.query('DELETE FROM novaworks.request_limits WHERE bucket=$1',[`ai:${day}`]);
 const permissions=(await db.query("SELECT has_schema_privilege('anon','novaworks','USAGE') AS anon,has_schema_privilege('authenticated','novaworks','USAGE') AS authenticated")).rows[0];assert.equal(permissions.anon,false);assert.equal(permissions.authenticated,false);
 console.log('PASS: live PostgreSQL seed/RBAC/atomic rollback/concurrent dedupe/session persistence/atomic quota/private schema. Fixture extraction only; no live AI call.');
}catch(error){console.error(`FAIL: PostgreSQL acceptance did not complete (${error.code||'ASSERTION_OR_CONFIGURATION'}); inspect configuration and database test assertions privately`);process.exitCode=1;}finally{if(db){await db.transaction(async client=>{for(const id of ids)await client.query('DELETE FROM novaworks.projects WHERE id=$1',[id]);await client.query('DELETE FROM novaworks.transcript_submissions WHERE hash=ANY($1::text[])',[[marker,badMarker]]);await client.query('DELETE FROM novaworks.sessions WHERE sid=$1',[sid]);}).catch(()=>{console.error('Acceptance cleanup failed; remove only pg-acceptance test artifacts privately');process.exitCode=1;});await db.close();}}
