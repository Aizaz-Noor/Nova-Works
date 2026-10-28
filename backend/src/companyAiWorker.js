import {configureBillingEnvironment} from './platform/billing/policy.js';
import {openConfiguredDatabase} from './db/database.js';
import {assertPlatformRuntimeRole} from './platform/runtime.js';
import {createPlatformService} from './platform/service.js';
import {startCompanyAiWorker} from './modules/companyAi/worker.js';

// Dedicated long-lived process, not an API/serverless request. Provision the
// worker identity's company memberships separately; never grant BYPASSRLS.
let db,worker,stopping=false;
async function shutdown(){if(stopping)return;stopping=true;try{await worker?.stop();}finally{await db?.close();}}
try{
 if(process.env.ERP_ENABLED!=='1'||process.env.COMPANY_AI_WORKER_ENABLED!=='1')throw new Error('Worker is opt-in');
 if(!process.env.COMPANY_AI_WORKER_USER_ID)throw new Error('Missing worker identity');
 const intervalMs=Number(process.env.COMPANY_AI_WORKER_INTERVAL_MS||5000);
 if(!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>60000)throw new Error('Invalid poll interval');
 process.env.DATABASE_AUTO_MIGRATE='0';
 db=await openConfiguredDatabase();await assertPlatformRuntimeRole(db);configureBillingEnvironment(db);
 if(db.kind==='postgres')await db.query('SELECT discarded_at,redacted_at FROM novaworks.platform_ai_jobs WHERE false');else db.prepare('SELECT discarded_at,redacted_at FROM platform_ai_jobs WHERE 0').all();
 if(!(await createPlatformService(db).listOrganizations(process.env.COMPANY_AI_WORKER_USER_ID)).some(o=>['OWNER','ADMIN'].includes(o.role)))throw new Error('Worker identity has no administered company');
 worker=startCompanyAiWorker(db,{userId:process.env.COMPANY_AI_WORKER_USER_ID,intervalMs,onResult:results=>console.log(JSON.stringify({event:'company_ai_worker_batch',counts:results.reduce((all,r)=>({...all,[r.status||r.code]:(all[r.status||r.code]||0)+1}),{})})),onError:code=>console.error(JSON.stringify({event:code}))});
 process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 console.log('Company AI worker started with restricted company membership');
}catch{await shutdown();console.error('Company AI worker startup failed; verify explicit opt-in, identity, migrations and restricted database configuration');process.exitCode=1;}
