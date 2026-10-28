import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,copyFileSync,constants,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {backupSqlite,validateBackup} from '../scripts/backup-sqlite.js';
import {openDatabase} from '../src/db/database.js';
import {seedUsers} from '../src/db/seed.js';
import {saveDraft} from '../src/services/projectService.js';
import {migratePlatform} from '../src/platform/migrations.js';
import {createPlatformService} from '../src/platform/service.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expected.json',import.meta.url)));
test('online WAL backup restores exact demo and organization records into a fresh database',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'novaworks-backup-'));const source=join(folder,'source.sqlite'),target=join(folder,'backup.sqlite'),restored=join(folder,'restored.sqlite');let db=openDatabase(source),copy;
 try{seedUsers(db);saveDraft(db,fixture,'backup-fixture');await migratePlatform(db);const platform=createPlatformService(db);const owner=await platform.register({name:'Recovery Owner',email:'restore@example.test',password:'restore-test-password-123'});await platform.createOrganization(owner.id,{name:'Recovery Company'});
 const tables=['users','projects','tasks','platform_organizations','platform_memberships','platform_migrations'];const expected=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
 // Keep source open in WAL mode: a raw main-file copy is not the backup mechanism.
 const result=await backupSqlite(source,target);assert.ok(result.pages>0);assert.equal(result.integrity,'ok');assert.equal(result.foreignKeys,'ok');copyFileSync(target,restored,constants.COPYFILE_EXCL);copy=new DatabaseSync(restored,{readOnly:true});for(const table of tables)assert.deepEqual(copy.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(),expected[table]);assert.deepEqual(validateBackup(restored),{integrity:'ok',foreignKeys:'ok'});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,3);
 }finally{copy?.close();db.close();rmSync(folder,{recursive:true,force:true});}
});
test('backup refuses existing destinations and missing sources without deleting files',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'novaworks-backup-safe-'));const source=join(folder,'source.sqlite'),target=join(folder,'keep.txt'),missing=join(folder,'missing.sqlite');const db=openDatabase(source);db.close();writeFileSync(target,'preserve me');
 try{await assert.rejects(backupSqlite(source,target));assert.equal(readFileSync(target,'utf8'),'preserve me');await assert.rejects(backupSqlite(missing,join(folder,'new.sqlite')));assert.equal(existsSync(missing),false);assert.equal(existsSync(join(folder,'new.sqlite')),false);await assert.rejects(backupSqlite(source,source));assert.deepEqual(validateBackup(source),{integrity:'ok',foreignKeys:'ok'});}finally{rmSync(folder,{recursive:true,force:true});}
});
test('backup validation rejects foreign-key violations and CLI has explicit safe outcomes',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'novaworks-backup-cli-'));const source=join(folder,'bad.sqlite');const db=new DatabaseSync(source);db.exec('PRAGMA foreign_keys=OFF;CREATE TABLE parent(id INTEGER PRIMARY KEY);CREATE TABLE child(parent_id INTEGER REFERENCES parent(id));INSERT INTO child VALUES(9)');db.close();
 try{assert.throws(()=>validateBackup(source),/foreign key/);const script=fileURLToPath(new URL('../scripts/backup-sqlite.js',import.meta.url));let result=spawnSync(process.execPath,[script],{encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);result=spawnSync(process.execPath,[script,source,join(folder,'invalid-backup.sqlite')],{encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/backup failed/);const valid=join(folder,'valid.sqlite');const live=openDatabase(valid);live.close();result=spawnSync(process.execPath,[script,valid,join(folder,'verified.sqlite')],{encoding:'utf8'});assert.equal(result.status,0);assert.match(result.stdout,/integrity=ok; foreignKeys=ok/);}finally{rmSync(folder,{recursive:true,force:true});}
});
