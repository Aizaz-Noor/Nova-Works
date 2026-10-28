// Disposable loopback-only PostgreSQL fixture. Never reads hosted DATABASE_URL.
import pg from '../backend/node_modules/pg/lib/index.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createTaskService} from '../backend/src/modules/projects/taskService.js';
import {createCommentService} from '../backend/src/modules/projects/commentService.js';
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim(),config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false},suffix=Date.now(),database=`nw_cmt_${suffix}`,role=`nw_cmt_rt_${suffix}`;
const control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const admin=new pg.Pool({...config,database});let runtime;
const adapter=pool=>({kind:'postgres',query:(sql,args)=>pool.query(sql,args),transaction:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
try{
 await admin.query(await readFile('backend/migrations/001_postgres.sql','utf8'));await migratePlatform(adapter(admin));let provision=await readFile('backend/scripts/provision-runtime.sql','utf8');provision=provision.replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);await admin.query(provision);const runtimePassword=`local-comment-${suffix}-test-only`;await admin.query(`ALTER ROLE ${role} PASSWORD '${runtimePassword}'`);runtime=new pg.Pool({...config,database,user:role,password:runtimePassword});const db=adapter(runtime);await assertPlatformRuntimeRole(db);
 const p=createPlatformService(db),comments=createCommentService(db),second=createCommentService(db),tasks=createTaskService(db),make=name=>p.register({name,email:`${name}@comments.test`,password:'comment-postgres-test-password'});
 const owner=await make('owner'),member=await make('member'),peer=await make('peer'),other=await make('other'),org=await p.createOrganization(owner.id,{name:'Alpha'}),beta=await p.createOrganization(other.id,{name:'Beta'});
 for(const user of [member,peer]){const i=await p.invite(owner.id,org.id,{email:user.email,role:'MEMBER'});await p.acceptInvitation(user.id,org.id,i.token);}
 const project=await p.createProject(owner.id,org.id,{name:'Delivery'}),task=await tasks.create(owner.id,org.id,{projectId:project.id,title:'Build',description:'Work',assigneeId:member.id,deadline:'2027-01-01',estimatedHours:1}),input={body:'Concurrent note',requestId:randomUUID()};
 const replies=await Promise.all([comments.create(member.id,org.id,task.id,input),second.create(member.id,org.id,task.id,input)]);assert.equal(replies[0].id,replies[1].id);assert.equal(replies.filter(r=>r.replayed).length,1);assert.equal((await comments.list(owner.id,org.id,task.id)).pagination.total,1);
 assert.equal((await db.query('SELECT * FROM novaworks.platform_task_comments')).rows.length,0);
 assert.equal((await p.transaction(peer.id,org.id,c=>c.query('SELECT * FROM novaworks.platform_task_comments'))).rows.length,0);
 assert.equal((await p.transaction(other.id,beta.id,c=>c.query('SELECT * FROM novaworks.platform_task_comments'))).rows.length,0);
 for(const sql of ['UPDATE novaworks.platform_task_comments SET body=body','DELETE FROM novaworks.platform_task_comments'])await assert.rejects(p.transaction(owner.id,org.id,c=>c.query(sql)),e=>e.code==='42501');
 await assert.rejects(p.transaction(member.id,org.id,c=>c.query('INSERT INTO novaworks.platform_task_comments(organization_id,id,task_id,author_id,request_id,body,created_at) VALUES(?,?,?,?,?,?,?)',[org.id,randomUUID(),task.id,owner.id,randomUUID(),'forged',new Date().toISOString()])),e=>e.code==='42501');
 await admin.query(`CREATE FUNCTION novaworks.reject_comment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='task.comment_added' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_comment_audit BEFORE INSERT ON novaworks.platform_audit FOR EACH ROW EXECUTE FUNCTION novaworks.reject_comment_audit();`);
 await assert.rejects(comments.create(member.id,org.id,task.id,{body:'rollback',requestId:randomUUID()}),/audit unavailable/);assert.equal((await comments.list(owner.id,org.id,task.id)).pagination.total,1);
 await admin.query('DROP TRIGGER reject_comment_audit ON novaworks.platform_audit');
 for(let n=1;n<29;n++)await comments.create(member.id,org.id,task.id,{body:`Quota note ${n}`,requestId:randomUUID()});
 const boundary=await Promise.allSettled([comments.create(member.id,org.id,task.id,{body:'Boundary A',requestId:randomUUID()}),second.create(member.id,org.id,task.id,{body:'Boundary B',requestId:randomUUID()})]);assert.equal(boundary.filter(r=>r.status==='fulfilled').length,1);assert.equal(boundary.find(r=>r.status==='rejected').reason.code,'COMMENT_RATE_LIMITED');assert.equal((await second.create(member.id,org.id,task.id,input)).id,replies[0].id);assert.equal((await comments.list(owner.id,org.id,task.id)).pagination.total,30);
 const evidence={result:'PASS',checks:['restricted nonowner runtime and forced comment RLS','independent services serialize same-request retry into one comment and one audit','no-context, unassigned-member and foreign-company rows invisible','forged author insert and UPDATE/DELETE denied42501','audit failure rolls back comment','persisted author/company quota allows one concurrent30th comment and saved retries at cap'],database};await mkdir('tmp/task-comments',{recursive:true});await writeFile('tmp/task-comments/postgres-results.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await runtime?.end();await admin.end();}
