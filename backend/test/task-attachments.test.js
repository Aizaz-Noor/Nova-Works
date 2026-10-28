import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,mkdtemp,readdir,readFile,rm,writeFile,rmdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {openDatabase} from '../src/db/database.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {taskAttachmentSql,taskAttachmentSqliteGuards,taskAttachmentRlsSql} from '../src/platform/taskAttachments.js';
import {createPlatformService} from '../src/platform/service.js';
import {createTaskService} from '../src/modules/projects/taskService.js';
import {createAttachmentService} from '../src/modules/projects/attachmentService.js';
import {createPrivateFileStorage} from '../src/modules/files/privateStorage.js';

async function setup(options={}){
 const db=openDatabase(':memory:');await migratePlatform(db);if(!db.prepare("SELECT name FROM sqlite_master WHERE name='platform_task_attachments'").get())db.exec(taskAttachmentSql()+taskAttachmentSqliteGuards());
 await mkdir('tmp',{recursive:true});const root=await mkdtemp(resolve('tmp/task-attachments-')),storage=await createPrivateFileStorage({root,...options}),p=createPlatformService(db),password='attachment-test-password',make=name=>p.register({name,email:`${name}@attachment.test`,password});
 const owner=await make('owner'),member=await make('member'),peer=await make('peer'),manager=await make('manager'),outsider=await make('outsider'),org=await p.createOrganization(owner.id,{name:'Files'}),other=await p.createOrganization(outsider.id,{name:'Other'});
 for(const [person,role]of [[member,'MEMBER'],[peer,'MEMBER'],[manager,'MANAGER']]){const invite=await p.invite(owner.id,org.id,{email:person.email,role});await p.acceptInvitation(person.id,org.id,invite.token);}
 const project=await p.createProject(owner.id,org.id,{name:'Delivery',managerId:manager.id}),task=await createTaskService(db).create(owner.id,org.id,{projectId:project.id,title:'Private delivery',description:'Work',assigneeId:member.id,deadline:'2027-01-01',estimatedHours:1});
 return {db,root,storage,p,owner,member,peer,manager,outsider,org,other,task,service:createAttachmentService(db,{storage}),close:async()=>{db.close();await rm(root,{recursive:true,force:true});}};
}
const input=(text='Private note')=>({requestId:randomUUID(),name:'delivery.txt',contentBase64:Buffer.from(text).toString('base64')});

test('private task attachments: actual bytes, task authorization, retry and immutable audited metadata',async()=>{
 const s=await setup();try{
  const payload=input('Private delivery evidence\n'),saved=await s.service.create(s.member.id,s.org.id,s.task.id,payload);assert.equal(saved.replayed,false);assert.equal(saved.size_bytes,26);assert.equal(saved.mime_type,'text/plain');assert.equal(saved.storage_key,undefined);
  const retries=await Promise.all([s.service.create(s.member.id,s.org.id,s.task.id,payload),createAttachmentService(s.db,{storage:s.storage}).create(s.member.id,s.org.id,s.task.id,payload)]);assert.ok(retries.every(x=>x.replayed&&x.id===saved.id));
  await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,{...payload,name:'changed.txt'}),e=>e.status===409);
  for(const user of [s.owner,s.manager,s.member]){const page=await s.service.list(user.id,s.org.id,s.task.id);assert.equal(page.attachments[0].id,saved.id);assert.equal(page.pagination.total,1);assert.equal(page.attachments[0].storage_key,undefined);const file=await s.service.download(user.id,s.org.id,s.task.id,saved.id);assert.equal(file.bytes.toString(),'Private delivery evidence\n');assert.equal(file.name,payload.name);}
  let reads=0;const guarded=createAttachmentService(s.db,{storage:{put:s.storage.put,get:async key=>{reads++;return s.storage.get(key);}}});
  await assert.rejects(guarded.download(s.peer.id,s.org.id,s.task.id,saved.id),e=>e.status===404);await assert.rejects(guarded.download(s.outsider.id,s.other.id,s.task.id,saved.id),e=>e.status===404);assert.equal(reads,0);
  await assert.rejects(s.service.create(s.peer.id,s.org.id,s.task.id,input()),e=>e.status===404);await assert.rejects(s.service.list(s.outsider.id,s.org.id,s.task.id),e=>e.status===403);
  const metadata=s.db.prepare('SELECT * FROM platform_task_attachments').get();assert.match(metadata.storage_key,/^[a-f0-9]{64}$/);assert.equal(metadata.sha256,createHash('sha256').update(Buffer.from(payload.contentBase64,'base64')).digest('hex'));assert.equal((await readdir(s.root)).filter(x=>x.endsWith('.bin')).length,1);assert.equal((await readFile(join(s.root,metadata.storage_key+'.bin'))).toString(),'Private delivery evidence\n');
  assert.throws(()=>s.db.prepare('UPDATE platform_task_attachments SET name=?').run('changed.txt'),/immutable/);assert.throws(()=>s.db.prepare('DELETE FROM platform_task_attachments').run(),/operator/);
  s.db.prepare('UPDATE platform_tasks SET assignee_id=?,version=version+1 WHERE organization_id=? AND id=?').run(s.peer.id,s.org.id,s.task.id);await assert.rejects(guarded.download(s.member.id,s.org.id,s.task.id,saved.id),e=>e.status===404);assert.equal(reads,0);
  assert.match(taskAttachmentRlsSql(),/FORCE ROW LEVEL SECURITY/);assert.match(taskAttachmentRlsSql(),/t.assignee_id/);
 }finally{await s.close();}
});

test('private task attachments: safe types, missing config, integrity, rollback and bounded orphan storage',async()=>{
 const s=await setup({maxBytes:2*1024*1024});try{
  const disabled=createAttachmentService(s.db);await assert.rejects(disabled.create(s.member.id,s.org.id,s.task.id,input()),e=>e.status===503&&e.code==='STORAGE_UNCONFIGURED');
  for(const name of ['../escape.txt','bad\nname.txt','bad\\name.txt','unsafe.html','bad.txt.','bad\ud800.txt','bad\udc00.txt'])await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,{...input(),name}),e=>[400,415].includes(e.status));
  for(const contentBase64 of ['', 'A===','eA','!!!!',Buffer.from([0,255]).toString('base64'),Buffer.alloc(2*1024*1024+1,65).toString('base64')])await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,{...input(),contentBase64}),e=>e.status===400||e.status===415);
  await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,{...input('<html>bad</html>')}),e=>e.status===415);await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,{...input(),name:'fake.png'}),e=>e.status===415);
  await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,{...input(),storage_key:'client-key'}),e=>e.status===400);
  const big={requestId:randomUUID(),name:'maximum.txt',contentBase64:Buffer.alloc(2*1024*1024,65).toString('base64')};
  s.db.exec("CREATE TRIGGER fail_attachment_audit BEFORE INSERT ON platform_audit WHEN NEW.action='task.attachment_added' BEGIN SELECT RAISE(ABORT,'attachment audit unavailable'); END;");await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,big),/attachment audit unavailable/);assert.equal((await s.service.list(s.member.id,s.org.id,s.task.id)).pagination.total,0);
  s.db.exec('DROP TRIGGER fail_attachment_audit');await assert.rejects(s.service.create(s.member.id,s.org.id,s.task.id,input('New file')),e=>e.status===507);const saved=await s.service.create(s.member.id,s.org.id,s.task.id,big);assert.equal(saved.size_bytes,2*1024*1024);assert.equal((await s.service.create(s.member.id,s.org.id,s.task.id,big)).replayed,true);
  const corrupt=createAttachmentService(s.db,{storage:{put:s.storage.put,get:async()=>Buffer.from('corrupt')}});await assert.rejects(corrupt.download(s.member.id,s.org.id,s.task.id,saved.id),e=>e.status===503&&e.code==='STORAGE_INTEGRITY');await assert.rejects(disabled.download(s.member.id,s.org.id,s.task.id,saved.id),e=>e.status===503);await assert.rejects(s.storage.get('../escape'),e=>e.status===503);
 }finally{await s.close();}
});

test('private task attachments: per-company cap serializes concurrent writes and preserves retries',async()=>{
 const s=await setup();try{const blobs=new Map(),storage={put:async(key,bytes)=>{blobs.set(key,bytes);},get:async key=>blobs.get(key)},one=createAttachmentService(s.db,{storage}),two=createAttachmentService(s.db,{storage});const first=input();const saved=await one.create(s.member.id,s.org.id,s.task.id,first);
  for(let n=1;n<99;n++)await one.create(s.member.id,s.org.id,s.task.id,input('Note '+n));const secondTask=await createTaskService(s.db).create(s.owner.id,s.org.id,{projectId:(s.db.prepare('SELECT project_id FROM platform_tasks WHERE id=?').get(s.task.id)).project_id,title:'Different assignment',description:'Other work',assigneeId:s.peer.id,deadline:'2027-01-01',estimatedHours:1});const results=await Promise.allSettled([one.create(s.member.id,s.org.id,s.task.id,input('Last A')),two.create(s.peer.id,s.org.id,secondTask.id,input('Last B'))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'ATTACHMENT_LIMIT');assert.equal((await two.create(s.member.id,s.org.id,s.task.id,first)).id,saved.id);assert.equal(s.db.prepare('SELECT file_count FROM platform_attachment_usage').get().file_count,100);assert.equal((await one.list(s.owner.id,s.org.id,s.task.id,{page:5,limit:20})).attachments.length>=19,true);assert.equal(blobs.size,100);
 }finally{await s.close();}
});

test('private storage: atomic immutable publication, staged orphan accounting and explicit stopped-writer lock recovery',async()=>{
 const s=await setup({maxBytes:2*1024*1024});try{
  const key='a'.repeat(64),bytes=Buffer.from('Published bytes');await s.storage.put(key,bytes);assert.deepEqual(await s.storage.get(key),bytes);assert.equal((await s.storage.put(key,bytes)).created,false);await assert.rejects(s.storage.put(key,Buffer.from('different')),e=>e.status===503);assert.equal((await readdir(s.root)).some(name=>name.startsWith('stage-')),false);
  const lock=join(s.root,'.write-lock');await mkdir(lock);await writeFile(join(lock,'owner.json'),JSON.stringify({pid:2147483647,recovery:'Fixture: all writers stopped'}));await assert.rejects(s.storage.put('b'.repeat(64),Buffer.from('retry')),e=>e.code==='STORAGE_LOCKED');assert.equal((await s.storage.get(key)).toString(),'Published bytes');
  // Operator fixture recovery only: all writers are stopped; no automatic lock stealing.
  await rm(join(lock,'owner.json'));await rmdir(lock);await s.storage.put('b'.repeat(64),Buffer.from('retry'));assert.equal((await s.storage.get('b'.repeat(64))).toString(),'retry');
  await writeFile(join(s.root,'stage-'+randomUUID()+'.tmp'),Buffer.alloc(2*1024*1024,65));await assert.rejects(s.storage.put('c'.repeat(64),Buffer.from('bounded')),e=>e.code==='STORAGE_CAPACITY');
 }finally{await s.close();}
});
