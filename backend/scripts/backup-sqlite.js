import {DatabaseSync,backup} from 'node:sqlite';
import {openSync,closeSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function validateBackup(path){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const integrity=db.prepare('PRAGMA integrity_check').all();
  if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw new Error('SQLite integrity check failed');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('SQLite foreign key check failed');
  return {integrity:'ok',foreignKeys:'ok'};
 }finally{db.close();}
}
export async function backupSqlite(source,destination){
 if(typeof source!=='string'||!source||typeof destination!=='string'||!destination)throw new Error('Explicit source and destination paths are required');
 const sourcePath=resolve(source),destinationPath=resolve(destination);
 if(sourcePath===destinationPath)throw new Error('Source and destination must differ');
 if(!statSync(sourcePath).isFile())throw new Error('Source must be an existing SQLite file');
 // Read-only prevents a typo from creating an empty source or applying app migrations.
 const db=new DatabaseSync(sourcePath,{readOnly:true});
 try{
  // Reserve exclusively before backup(), whose native API otherwise overwrites.
  // Failure artifacts are deliberately retained; no existing file is deleted.
  const reserved=openSync(destinationPath,'wx',0o600);closeSync(reserved);
  const pages=await backup(db,destinationPath);
  const checks=validateBackup(destinationPath);
  return {pages,...checks};
 }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 if(args.length!==2){console.error('Usage: node backend/scripts/backup-sqlite.js <source.sqlite> <new-backup.sqlite>');process.exitCode=1;}
 else try{const result=await backupSqlite(...args);console.log(`SQLite backup verified: ${result.pages} pages; integrity=ok; foreignKeys=ok.`);}catch{console.error('SQLite backup failed. Check paths, permissions, source validity and that destination does not exist. Any new destination artifact is unverified; preserve the source.');process.exitCode=1;}
}
