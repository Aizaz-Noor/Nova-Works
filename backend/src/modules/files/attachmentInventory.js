import {lstat,readdir,readFile,realpath} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';

// Operator-only inventory. It never mutates objects, database rows, locks or quotas.
// Call with a trusted complete metadata snapshot while attachment writers are stopped.
export async function inspectAttachmentInventory({root,records}) {
 if(typeof root!=='string'||!isAbsolute(root)||!Array.isArray(records))throw new Error('Absolute private root and complete attachment metadata are required');
 if((await lstat(root)).isSymbolicLink())throw new Error('Private root cannot be a symbolic link');
 const canonical=await realpath(root),entries=await readdir(canonical,{withFileTypes:true}),objects=new Map(),issues=[],referenced=new Set();let bytes=0,stagedBytes=0;
 for(const entry of entries){
  const path=join(canonical,entry.name),info=await lstat(path);
  if(info.isSymbolicLink()){issues.push({kind:'UNSAFE_ENTRY',entry:entry.name});continue;}
  if(entry.name==='.write-lock'){issues.push({kind:'WRITE_LOCK_PRESENT',entry:entry.name});continue;}
  if(/^stage-[a-f0-9-]+\.tmp$/.test(entry.name)&&info.isFile()){stagedBytes+=info.size;issues.push({kind:'STAGED_ORPHAN',entry:entry.name,size:info.size});continue;}
  if(!/^[a-f0-9]{64}\.bin$/.test(entry.name)||!info.isFile()){issues.push({kind:'UNKNOWN_ENTRY',entry:entry.name});continue;}
  const key=entry.name.slice(0,-4);objects.set(key,{path,size:info.size});bytes+=info.size;
 }
 for(const row of records){
  const key=row.storage_key;
  if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key)||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(Number(row.size_bytes))||Number(row.size_bytes)<1||Number(row.size_bytes)>2097152){issues.push({kind:'INVALID_METADATA',id:row.id});continue;}
  referenced.add(key);const object=objects.get(key);
  if(!object){issues.push({kind:'MISSING_OBJECT',id:row.id,key});continue;}
  if(object.size!==Number(row.size_bytes)){issues.push({kind:'SIZE_MISMATCH',id:row.id,key,expected:Number(row.size_bytes),actual:object.size});continue;}
  // Every permitted object is <=2MiB; reject before reading unexpectedly large files.
  const content=await readFile(object.path),hash=createHash('sha256').update(content).digest('hex');
  if(hash!==row.sha256)issues.push({kind:'HASH_MISMATCH',id:row.id,key});
 }
 for(const [key,object]of objects)if(!referenced.has(key))issues.push({kind:'UNREFERENCED_OBJECT',key,size:object.size});
 return {format:'novaworks-private-attachment-inventory-v1',observedAt:new Date().toISOString(),completeSnapshotRequired:true,metadataCount:records.length,objectCount:objects.size,objectBytes:bytes,stagedBytes,healthy:issues.length===0,issues};
}
