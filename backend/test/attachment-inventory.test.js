import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {inspectAttachmentInventory} from '../src/modules/files/attachmentInventory.js';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('operator inventory distinguishes integrity failures and orphans without changing private bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nw-inventory-')),bytes=Buffer.from('Private evidence'),key='a'.repeat(64),row={id:'fixture',storage_key:key,size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};await writeFile(join(root,key+'.bin'),bytes);
 assert.equal((await inspectAttachmentInventory({root,records:[row]})).healthy,true);
 await writeFile(join(root,'b'.repeat(64)+'.bin'),'orphan');await writeFile(join(root,'stage-1234.tmp'),'partial');await mkdir(join(root,'.write-lock'));const before=await readdir(root);
 const report=await inspectAttachmentInventory({root,records:[{...row,sha256:'0'.repeat(64)},{...row,id:'missing',storage_key:'c'.repeat(64)},{...row,id:'bad',storage_key:'../escape'}]});assert.equal(report.healthy,false);assert.deepEqual(new Set(report.issues.map(x=>x.kind)),new Set(['HASH_MISMATCH','MISSING_OBJECT','INVALID_METADATA','UNREFERENCED_OBJECT','STAGED_ORPHAN','WRITE_LOCK_PRESENT']));assert.deepEqual(await readdir(root),before);assert.deepEqual(await readFile(join(root,key+'.bin')),bytes);
});
test('operator CLI reads an existing database, preserves sources and refuses existing output',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'nw-inventory-cli-')),root=join(folder,'private'),database=join(folder,'source.sqlite'),report=join(folder,'report.json');await mkdir(root);const db=new DatabaseSync(database);db.exec('CREATE TABLE platform_task_attachments(organization_id TEXT,id TEXT,storage_key TEXT,size_bytes INTEGER,sha256 TEXT)');db.close();const before=await readFile(database),script=fileURLToPath(new URL('../scripts/inspect-private-attachments.js',import.meta.url)),run=(output)=>spawnSync(process.execPath,[script,'--writers-stopped',database,root,output],{encoding:'utf8',windowsHide:true});
 const first=run(report);assert.equal(first.status,0,first.stderr);assert.equal(JSON.parse(await readFile(report,'utf8')).healthy,true);const saved=await readFile(report);assert.equal(run(report).status,1);assert.deepEqual(await readFile(report),saved);assert.deepEqual(await readFile(database),before);assert.equal(run(join(root,'report.json')).status,1);assert.deepEqual(await readdir(root),[]);
});
