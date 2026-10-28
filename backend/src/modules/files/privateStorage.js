import {mkdir,lstat,realpath,readdir,readFile,open,rmdir,link,unlink,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ApiError} from '../../middleware/errorHandler.js';
const unavailable=()=>new ApiError(503,'STORAGE_UNAVAILABLE','Private file storage is temporarily unavailable');
const MAX_FILE=2*1024*1024;
// Exclusive immutable objects; the cap includes orphans from failed/ambiguous DB commits.
export async function createPrivateFileStorage({root,maxBytes=256*1024*1024}={}){
 if(typeof root!=='string'||!root||!isAbsolute(root)||!Number.isSafeInteger(maxBytes)||maxBytes<MAX_FILE)throw new Error('Explicit absolute private storage root and capacity required');
 const target=resolve(root),served=resolve(fileURLToPath(new URL('../../../../app/client/dist/',import.meta.url)));
 const within=(child,parent)=>{const rel=relative(parent,child);return !rel||(!rel.startsWith('..')&&!isAbsolute(rel));};
 if(within(target,served))throw new Error('Private storage cannot be inside the served client directory');
 await mkdir(target,{recursive:true,mode:0o700});if((await lstat(target)).isSymbolicLink())throw new Error('Private storage root cannot be a symbolic link');
 const canonical=await realpath(target);if(within(canonical,served))throw new Error('Private storage cannot resolve into served content');
 const path=key=>{if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))throw unavailable();return join(canonical,key+'.bin');};
 async function checkedRead(key){const file=path(key),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_FILE)throw unavailable();const handle=await open(file,'r');try{const stat=await handle.stat();if(stat.size>MAX_FILE||stat.ino!==info.ino||stat.dev!==info.dev)throw unavailable();const bytes=await handle.readFile();if(bytes.length>MAX_FILE)throw unavailable();return bytes;}finally{await handle.close();}}
 return {
  async put(key,bytes){if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_FILE)throw unavailable();const lock=join(canonical,'.write-lock');let locked=false;
   try{if((await realpath(target))!==canonical)throw unavailable();try{await mkdir(lock);}catch(error){if(error.code==='EEXIST')throw new ApiError(503,'STORAGE_LOCKED','Private storage write lock is held. Retry, or ask the administrator to inspect it.');throw error;}locked=true;await writeFile(join(lock,'owner.json'),JSON.stringify({pid:process.pid,createdAt:new Date().toISOString(),recovery:'Stop all attachment-writing processes, inspect owner liveness, then remove this lock directory. Never remove an active lock.'}),{flag:'wx',mode:0o600});
    try{const prior=await checkedRead(key);if(!prior.equals(bytes))throw unavailable();return {created:false};}catch(error){if(error.code!=='ENOENT')throw error;}
    let total=0;for(const entry of await readdir(canonical)){if(!/^(?:[a-f0-9]{64}\.bin|stage-[a-f0-9-]+\.tmp)$/.test(entry))continue;const stat=await lstat(join(canonical,entry));if(!stat.isFile()||stat.isSymbolicLink())throw unavailable();total+=stat.size;}
    if(total+bytes.length>maxBytes)throw new ApiError(507,'STORAGE_CAPACITY','Private storage capacity reached. Contact the administrator.');
    const staged=join(canonical,'stage-'+randomUUID()+'.tmp');try{const handle=await open(staged,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await link(staged,path(key));return {created:true};}finally{await unlink(staged).catch(()=>{});}
   }catch(error){if(error instanceof ApiError)throw error;throw unavailable();}finally{if(locked){await unlink(join(lock,'owner.json')).catch(()=>{});await rmdir(lock).catch(()=>{});};}
  },
  async get(key){try{if((await realpath(target))!==canonical)throw unavailable();return await checkedRead(key);}catch{throw unavailable();}},
 };
}
