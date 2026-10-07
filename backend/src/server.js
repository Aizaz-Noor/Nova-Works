import { openDatabase } from './db/database.js';
import { createApp } from './app.js';
const db=openDatabase();
const app=createApp({db});
const port=Number(process.env.PORT||3001);
const server=app.listen(port,()=>console.log(`NovaWorks backend listening on port ${port}`));
function shutdown(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
