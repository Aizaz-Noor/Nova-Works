// Disposable fixture recovery: database AND private objects, then authenticated HTTP.
import {readdir,readFile,writeFile,mkdtemp,cp,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {openDatabase} from '../backend/src/db/database.js';
import {createPrivateFileStorage} from '../backend/src/modules/files/privateStorage.js';
import {createApp} from '../backend/src/app.js';
const candidates=(await readdir('tmp',{withFileTypes:true})).filter(x=>x.isDirectory()&&x.name.startsWith('task-attachments-browser-'));
let source,latest=-1;
for(const entry of candidates){try{const result=JSON.parse(await readFile(join('tmp',entry.name,'results.json'),'utf8'));const changed=(await stat(join('tmp',entry.name,'results.json'))).mtimeMs;if(result.result==='PASS'&&changed>latest){source=resolve('tmp',entry.name);latest=changed;}}catch{}}
assert.ok(source,'Run the actual attachment browser fixture first');
const output=await mkdtemp(resolve('tmp/task-attachments-recovery-')),evidence={result:'FAIL',source};let db,server;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 // Source browser closes its database/server before publishing a PASS result.
 await cp(join(source,'fixture.sqlite'),join(output,'restored.sqlite'));await cp(join(source,'private'),join(output,'private'),{recursive:true});
 const manifest=[];for(const name of await readdir(join(source,'private'))){assert.match(name,/^[a-f0-9]{64}\.bin$/);const original=await readFile(join(source,'private',name)),restored=await readFile(join(output,'private',name));assert.deepEqual(restored,original);manifest.push({name,size:original.length,sha256:hash(original)});}assert.ok(manifest.length);
 db=openDatabase(join(output,'restored.sqlite'));const row=db.prepare('SELECT * FROM platform_task_attachments').get();assert.ok(row);const bytes=await readFile(join(output,'private',row.storage_key+'.bin'));assert.equal(hash(bytes),row.sha256);assert.equal(bytes.length,row.size_bytes);
 const storage=await createPrivateFileStorage({root:join(output,'private')}),origin='http://127.0.0.1:5173';server=createApp({db,erpEnabled:true,attachmentOptions:{storage},frontendOrigin:origin,sessionSecret:'attachment-recovery-session-fixture-secret32',production:false}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`,headers={Origin:origin,'Content-Type':'application/json'};
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'comments-browser@example.test',password:'comment-browser-test-password'})});assert.equal(login.status,200);headers.Cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/v1/organizations/select',{method:'POST',headers,body:JSON.stringify({organizationId:row.organization_id})})).status,200);
 const url=base+`/api/v1/tasks/${row.task_id}/attachments/${row.id}/download`,response=await fetch(url,{headers});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);assert.equal((await fetch(url)).status,401);
 evidence.result='PASS';evidence.manifest=manifest;evidence.checks=['closed fixture database and all private object bytes copied independently','manifest hashes and database size/hash references match','restored process authenticates/selects company and downloads exact private bytes; anonymous401'];
}catch(error){evidence.error=error.message;throw error;}
finally{if(server)await new Promise(r=>server.close(r));db?.close();await writeFile(join(output,'results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({output,...evidence},null,2));}
