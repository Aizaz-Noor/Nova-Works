import {DatabaseSync} from 'node:sqlite';
import {writeFile} from 'node:fs/promises';
import {isAbsolute,resolve,relative} from 'node:path';
import {inspectAttachmentInventory} from '../src/modules/files/attachmentInventory.js';

// Local SQLite operator tool. Hosted PostgreSQL needs its own complete authorized snapshot.
const args=process.argv.slice(2);let db;
try{
 if(args.length!==4||args[0]!=='--writers-stopped'||args.slice(1).some(path=>!isAbsolute(path)))throw new Error('Invalid operator arguments');
 const [,database,root,output]=args;
 const inside=relative(resolve(root),resolve(output));
 if([database,root].map(path=>resolve(path)).includes(resolve(output))||!inside||(!inside.startsWith('..')&&!isAbsolute(inside)))throw new Error('Output must be separate from source database and private root');
 db=new DatabaseSync(database,{readOnly:true});
 const records=db.prepare('SELECT id,storage_key,size_bytes,sha256 FROM platform_task_attachments ORDER BY organization_id,id').all();
 const report=await inspectAttachmentInventory({root,records});
 // Exclusive output prevents replacing any existing file, including the source DB.
 await writeFile(output,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({healthy:report.healthy,metadataCount:report.metadataCount,objectCount:report.objectCount,issueCount:report.issues.length}));
 if(!report.healthy)process.exitCode=2;
}catch{
 console.error('Inventory failed. Usage: node backend/scripts/inspect-private-attachments.js --writers-stopped <absolute-existing.sqlite> <absolute-private-root> <absolute-new-report.json>. Stop all attachment writers first. Sources are read-only; no files are removed.');process.exitCode=1;
}finally{db?.close();}
