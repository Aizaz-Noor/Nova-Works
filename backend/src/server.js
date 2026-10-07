import {openConfiguredDatabase} from './db/database.js';
import {createApp} from './app.js';
let db;
try{db=await openConfiguredDatabase();const app=createApp({db});const port=Number(process.env.PORT||3001);const server=app.listen(port,()=>console.log(`NovaWorks backend listening on port ${port}`));let stopping=false;function shutdown(){if(stopping)return;stopping=true;server.close(async()=>{await db.close();process.exit(0);});}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);}catch{await db?.close();console.error('Backend startup failed; verify database/session configuration and connectivity');process.exitCode=1;}
