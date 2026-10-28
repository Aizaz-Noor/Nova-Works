import {createPlatformService} from './platform/service.js';
import {openConfiguredDatabase} from './db/database.js';
import {assertPlatformRuntimeRole} from './platform/runtime.js';
import {configureBillingEnvironment} from './platform/billing/policy.js';
import {startBillingReconciler} from './platform/billing/reconciler.js';
let db,worker,stopping=false;
async function stop(){if(stopping)return;stopping=true;try{await worker?.stop();}finally{await db?.close();}}
try{
 if(process.env.ERP_ENABLED!=='1'||process.env.BILLING_RECONCILER_ENABLED!=='1'||!process.env.BILLING_RECONCILER_USER_ID)throw new Error('Explicit scoped reconciler configuration required');
 const intervalMs=Number(process.env.BILLING_RECONCILER_INTERVAL_MS||60000);if(!Number.isSafeInteger(intervalMs)||intervalMs<60000||intervalMs>3600000)throw new Error('Invalid poll interval');
 process.env.DATABASE_AUTO_MIGRATE='0';db=await openConfiguredDatabase();await assertPlatformRuntimeRole(db);configureBillingEnvironment(db);
 if(!(await createPlatformService(db).listOrganizations(process.env.BILLING_RECONCILER_USER_ID)).some(c=>c.role==='OWNER'))throw new Error('Scoped owner membership required');
 worker=startBillingReconciler(db,{userId:process.env.BILLING_RECONCILER_USER_ID,intervalMs,onResult:results=>{const fresh=results.filter(r=>!r.replayed);if(fresh.length)console.log(JSON.stringify({event:'billing_reconciliation_batch',counts:fresh.reduce((all,r)=>({...all,[r.outcome||r.code]:(all[r.outcome||r.code]||0)+1}),{})}));},onError:code=>console.error(JSON.stringify({event:code}))});
 process.on('SIGINT',stop);process.on('SIGTERM',stop);console.log('Scoped billing reconciler started');
}catch{await stop();console.error('Billing reconciler startup failed; verify explicit opt-in, identity, policy, migrations and restricted database configuration');process.exitCode=1;}
