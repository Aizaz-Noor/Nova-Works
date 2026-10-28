import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform,migrations} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createTimesheetService} from '../src/modules/timesheets/service.js';
const bad=code=>error=>error.code===code;
async function setup(){
 const db=openDatabase(':memory:');await migratePlatform(db);const platform=createPlatformService(db),tasks=createTaskService(db),time=createTimesheetService(db);
 const people=await Promise.all(['owner','manager','worker','peer','beta'].map(name=>platform.register({name,email:`${name}@time.test`,password:'timesheet-test-password'}))),[owner,manager,worker,peer,beta]=people;
 const company=await platform.createOrganization(owner.id,{name:'Alpha'}),other=await platform.createOrganization(beta.id,{name:'Beta'});
 for(const [person,role]of[[manager,'MANAGER'],[worker,'MEMBER'],[peer,'MEMBER']]){const invitation=await platform.invite(owner.id,company.id,{email:person.email,role});await platform.acceptInvitation(person.id,company.id,invitation.token);}
 const project=await platform.createProject(owner.id,company.id,{name:'Client delivery',managerId:manager.id,deadline:'2099-12-31'}),privateProject=await platform.createProject(owner.id,company.id,{name:'Owner project'});
 const task=await tasks.create(manager.id,company.id,{projectId:project.id,title:'Implement work',description:'Delivery',assigneeId:worker.id,deadline:'2099-12-01',estimatedHours:8});return{db,platform,tasks,time,owner,manager,worker,peer,beta,company,other,project,privateProject,task};
}
function body(s,changes={}){return{requestId:'request-1',projectId:s.project.id,taskId:s.task.id,workDate:'2026-01-10',minutes:90,billable:true,description:'Implementation work',...changes};}

test('time: private drafts, reviewed scopes, rejection/resubmission, immutable approvals and exact summaries',async()=>{
 const s=await setup(),{db,time:t,owner:o,manager:m,worker:w,peer,beta,company:a,other:b}=s;
 try{
  assert.equal((await t.projects(w.id,a.id)).pagination.total,1);assert.equal((await t.tasks(w.id,a.id,s.project.id)).taskRequired,true);await assert.rejects(t.tasks(w.id,a.id,s.privateProject.id),bad('NOT_FOUND'));
  const created=await t.create(w.id,a.id,body(s));let entry=created.entry;assert.equal(created.replayed,false);assert.equal(entry.user_id,w.id);assert.equal(entry.billable,true);
  assert.equal((await t.list(m.id,a.id,{scope:'team'})).pagination.total,0);await assert.rejects(t.entry(m.id,a.id,entry.id),bad('NOT_FOUND'));await assert.rejects(t.entry(peer.id,a.id,entry.id),bad('NOT_FOUND'));await assert.rejects(t.entry(beta.id,b.id,entry.id),bad('NOT_FOUND'));await assert.rejects(t.list(w.id,a.id,{scope:'team'}),bad('ROLE_FORBIDDEN'));
  await assert.rejects(t.update(m.id,a.id,entry.id,{version:1,minutes:1}),bad('ROLE_FORBIDDEN'));await assert.rejects(t.update(w.id,a.id,entry.id,{version:99,minutes:60}),bad('VERSION_CONFLICT'));
  entry=await t.submit(w.id,a.id,entry.id,{version:1});assert.equal(entry.submission_no,1);assert.equal((await t.list(m.id,a.id,{scope:'team',status:'SUBMITTED'})).summary.minutes,'90');
  await assert.rejects(t.update(w.id,a.id,entry.id,{version:entry.version,description:'Rewrite'}),bad('TIME_LOCKED'));await assert.rejects(t.review(w.id,a.id,entry.id,{version:entry.version,decision:'APPROVE'}),bad('SELF_APPROVAL'));await assert.rejects(t.review(peer.id,a.id,entry.id,{version:entry.version,decision:'APPROVE'}),bad('ROLE_FORBIDDEN'));await assert.rejects(t.review(m.id,a.id,entry.id,{version:entry.version,decision:'REJECT',note:''}),bad('BAD_INPUT'));
  assert.throws(()=>db.prepare('UPDATE platform_time_entries SET minutes=1,version=version+1 WHERE id=?').run(entry.id),/immutable/);
  entry=await t.review(m.id,a.id,entry.id,{version:entry.version,decision:'REJECT',note:'Clarify delivery scope'});assert.equal(entry.approvals.length,1);entry=await t.update(w.id,a.id,entry.id,{version:entry.version,minutes:75,description:'Implemented approved delivery scope'});entry=await t.submit(w.id,a.id,entry.id,{version:entry.version});assert.equal(entry.submission_no,2);
  const decisions=await Promise.allSettled([t.review(m.id,a.id,entry.id,{version:entry.version,decision:'APPROVE',note:'Confirmed'}),t.review(o.id,a.id,entry.id,{version:entry.version,decision:'APPROVE',note:'Confirmed'})]);assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);assert.equal(decisions.find(r=>r.status==='rejected').reason.code,'VERSION_CONFLICT');entry=await t.entry(w.id,a.id,entry.id);assert.equal(entry.status,'APPROVED');assert.equal(entry.approvals.length,2);assert.deepEqual(entry.approvals.map(row=>row.submission_no),[1,2]);
  await assert.rejects(t.update(w.id,a.id,entry.id,{version:entry.version,billable:false}),bad('TIME_LOCKED'));await assert.rejects(t.void(w.id,a.id,entry.id,{version:entry.version}),bad('TIME_LOCKED'));assert.throws(()=>db.prepare("UPDATE platform_time_entries SET status='DRAFT',version=version+1 WHERE id=?").run(entry.id),/immutable/);assert.throws(()=>db.prepare('DELETE FROM platform_time_approvals WHERE entry_id=?').run(entry.id),/immutable/);
  await t.create(w.id,a.id,body(s,{requestId:'second',minutes:30,billable:false}));const mine=await t.list(w.id,a.id,{limit:'1'});assert.equal(mine.entries.length,1);assert.equal(mine.pagination.total,2);assert.deepEqual(mine.summary,{minutes:'105',billableMinutes:'75',approvedMinutes:'75',approvedBillableMinutes:'75'});assert.equal((await t.list(m.id,a.id,{scope:'team'})).summary.minutes,'75');assert.equal((await t.list(beta.id,b.id,{scope:'team'})).summary.minutes,'0');
  const privateTime=await t.create(o.id,a.id,body(s,{requestId:'private-time',projectId:s.privateProject.id,taskId:null})),privateSubmission=await t.submit(o.id,a.id,privateTime.entry.id,{version:1});await assert.rejects(t.review(m.id,a.id,privateSubmission.id,{version:privateSubmission.version,decision:'APPROVE'}),bad('ROLE_FORBIDDEN'));await assert.rejects(t.entry(m.id,a.id,privateSubmission.id),bad('NOT_FOUND'));
  const own=await t.create(o.id,a.id,body(s,{requestId:'own',taskId:null})),submitted=await t.submit(o.id,a.id,own.entry.id,{version:1});await assert.rejects(t.review(o.id,a.id,submitted.id,{version:submitted.version,decision:'APPROVE'}),bad('SELF_APPROVAL'));
 }finally{db.close();}
});

test('time: idempotent creation, per-worker day serialization, discard, references, strict values and reassignment',async()=>{
 const s=await setup(),{db,time:t,worker:w,manager:m,company:a,tasks}=s;
 try{
  const requests=await Promise.all([t.create(w.id,a.id,body(s)),t.create(w.id,a.id,body(s))]);assert.equal(requests[0].entry.id,requests[1].entry.id);assert.deepEqual(requests.map(r=>r.replayed).sort(),[false,true]);await assert.rejects(t.create(w.id,a.id,body(s,{minutes:30})),bad('REQUEST_REUSED'));
  const cap=await Promise.allSettled([t.create(w.id,a.id,body(s,{requestId:'large-1',workDate:'2026-01-11',minutes:800})),t.create(w.id,a.id,body(s,{requestId:'large-2',workDate:'2026-01-11',minutes:800}))]);assert.equal(cap.filter(r=>r.status==='fulfilled').length,1);assert.equal(cap.find(r=>r.status==='rejected').reason.code,'DAILY_LIMIT');const large=cap.find(r=>r.status==='fulfilled').value.entry;await t.void(w.id,a.id,large.id,{version:1});assert.equal((await t.create(w.id,a.id,body(s,{requestId:'large-3',workDate:'2026-01-11',minutes:1440}))).entry.minutes,1440);
  for(const changes of [{minutes:0},{minutes:1.5},{minutes:1441},{minutes:'60'},{billable:1},{billable:null},{workDate:'2026-02-30'},{workDate:'2999-01-01'},{description:'bad\0'},{userId:s.peer.id}])await assert.rejects(t.create(w.id,a.id,body(s,{requestId:JSON.stringify(changes),...changes})),error=>error.status===400);
  await assert.rejects(t.create(w.id,a.id,body(s,{requestId:'no-task',taskId:null})),bad('ROLE_FORBIDDEN'));await assert.rejects(t.create(w.id,a.id,body(s,{requestId:'wrong-project',projectId:s.privateProject.id})),bad('NOT_FOUND'));await assert.rejects(t.create(w.id,a.id,body(s,{requestId:'no-project',projectId:'absent'})),bad('NOT_FOUND'));
  const entry=requests[0].entry;await tasks.update(m.id,a.id,s.task.id,{assigneeId:s.peer.id,version:s.task.version});assert.equal((await t.entry(w.id,a.id,entry.id)).user_id,w.id);await assert.rejects(t.submit(w.id,a.id,entry.id,{version:1}),bad('ROLE_FORBIDDEN'));assert.equal((await t.void(w.id,a.id,entry.id,{version:1})).status,'VOID');
  const count=db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action='time.created'").get().n;assert.equal(count,3);
  assert.throws(()=>db.prepare('INSERT INTO platform_time_entries(organization_id,id,user_id,project_id,task_id,request_id,request_hash,work_date,minutes,billable,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(a.id,'bad-reference',w.id,s.privateProject.id,s.task.id,'raw','hash','2026-01-10',30,0,'Bad','now','now'),/FOREIGN KEY/);
 }finally{db.close();}
});

test('time migration preserves prior version checksums and applies forced policies',async()=>{
 const db=openDatabase(':memory:');try{
  db.exec('CREATE TABLE platform_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');for(const migration of migrations.slice(0,5)){db.exec(migration.sql);db.prepare('INSERT INTO platform_migrations VALUES (?,?,?)').run(migration.version,createHash('sha256').update(migration.sql).digest('hex'),'baseline');}const before=db.prepare('SELECT version,checksum FROM platform_migrations ORDER BY version').all();await migratePlatform(db);await migratePlatform(db);assert.deepEqual(db.prepare("SELECT version,checksum FROM platform_migrations WHERE version<'007_timesheets' ORDER BY version").all(),before);for(const table of ['time_entries','time_approvals'])assert.ok(migrations[5].postgresSql.includes(`ALTER TABLE novaworks.platform_${table} FORCE ROW LEVEL SECURITY`));
 }finally{db.close();}
});
