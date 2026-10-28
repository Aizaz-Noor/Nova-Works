// Local human acceptance only; separate durable data, no hosted DB or provider calls.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {openDatabase} from '../backend/src/db/database.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createApp} from '../backend/src/app.js';
import {mfaOptionsFromEnvironment} from '../backend/src/platform/mfa/config.js';
import {ApiError} from '../backend/src/middleware/errorHandler.js';
const folder=resolve('tmp/human-testing');await mkdir(folder,{recursive:true});const privateFile=join(folder,'private-config.json');let config;
try{config=JSON.parse(await readFile(privateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config={sessionSecret:randomBytes(48).toString('base64url'),mfa:{activeKeyId:'local',keys:{local:randomBytes(32).toString('base64')}}};await writeFile(privateFile,JSON.stringify(config),{flag:'wx',mode:0o600});}
process.env.TRUST_PROXY='0';const db=openDatabase(join(folder,'novaworks.sqlite'));await migratePlatform(db);
const noProvider=async()=>{throw new ApiError(503,'LOCAL_PROVIDER_DISABLED','AI provider is not connected in this local testing session.');};
const app=createApp({db,erpEnabled:true,production:false,frontendOrigin:'http://127.0.0.1:3039',sessionSecret:config.sessionSecret,mfaOptions:mfaOptionsFromEnvironment({MFA_KEYRING_JSON:JSON.stringify(config.mfa)}),billingOptions:{enabled:false},recoveryOptions:{},extract:noProvider,companyAiOptions:{extract:noProvider}});
const server=app.listen(3039,'127.0.0.1',()=>console.log('NovaWorks local testing: http://127.0.0.1:3039 — separate saved test data; AI/email/checkout disconnected.'));let stopping=false;function stop(){if(stopping)return;stopping=true;server.close(()=>{db.close();process.exit(0);});}process.on('SIGINT',stop);process.on('SIGTERM',stop);
