import {createPrivateFileStorage} from './modules/files/privateStorage.js';
import {openConfiguredDatabase} from './db/database.js';
import {createApp} from './app.js';
import {migratePlatform} from './platform/migrations.js';
import {assertPlatformRuntimeRole} from './platform/runtime.js';
if(process.env.ERP_ENABLED==='1')process.env.DATABASE_AUTO_MIGRATE='0';
let db;
try{db=await openConfiguredDatabase();if(process.env.ERP_ENABLED==='1'&&db.kind!=='postgres')await migratePlatform(db);if(process.env.ERP_ENABLED==='1')await assertPlatformRuntimeRole(db);const attachmentOptions=process.env.PRIVATE_ATTACHMENT_ROOT?{storage:await createPrivateFileStorage({root:process.env.PRIVATE_ATTACHMENT_ROOT})}:undefined;const app=createApp({db,attachmentOptions});const port=Number(process.env.PORT||3001);const server=app.listen(port,()=>console.log(`NovaWorks backend listening on port ${port}`));let stopping=false;function shutdown(){if(stopping)return;stopping=true;server.close(async()=>{await db.close();process.exit(0);});}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);}catch{await db?.close();console.error('Backend startup failed; verify database/session configuration and connectivity');process.exitCode=1;}
