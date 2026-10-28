import {randomUUID} from 'node:crypto';
import {openConfiguredDatabase} from '../src/db/database.js';
import {assertPlatformRuntimeRole} from '../src/platform/runtime.js';
import {configureBillingEnvironment} from '../src/platform/billing/policy.js';
import {createBillingOperations} from '../src/platform/billing/operations.js';
let db;
try{
 const command=process.env.SUBSCRIPTION_COMMAND,owner=process.env.SUBSCRIPTION_OWNER_USER_ID,organization=process.env.SUBSCRIPTION_ORGANIZATION_ID;
 if(!['PROVISION','RECONCILE','REPLACE'].includes(command)||!owner||!organization)throw new Error('Explicit operation, owner and company required');
 process.env.DATABASE_AUTO_MIGRATE='0';db=await openConfiguredDatabase();await assertPlatformRuntimeRole(db);configureBillingEnvironment(db);
 const requestId=process.env.SUBSCRIPTION_REQUEST_ID||randomUUID(),result=await createBillingOperations(db).execute(owner,organization,command,{requestId,...(command!=='RECONCILE'?{subscriptionId:process.env.PADDLE_SUBSCRIPTION_ID}:{}),...(command==='REPLACE'?{currentSubscriptionId:process.env.PADDLE_PREVIOUS_SUBSCRIPTION_ID}:{})});
 console.log(JSON.stringify({operation:result.receipt.operation,outcome:result.receipt.outcome,replayed:result.replayed}));
}catch{console.error('Subscription operation failed; verify owner membership, configured provider, policy and command. No provider subscription was created or charged.');process.exitCode=1;}finally{await db?.close();}
