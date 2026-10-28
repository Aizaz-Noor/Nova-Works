import {openConfiguredDatabase} from '../src/db/database.js';
import {createRecoveryRetention} from '../src/platform/recoveryRetention.js';
let db;
try{
 if(process.env.ERP_ENABLED!=='1'||process.env.RECOVERY_RETENTION_ENABLED!=='1')throw new Error('Explicit opt-in required');
 const mode=process.env.RECOVERY_RETENTION_MODE||'PREVIEW',retentionDays=Number(process.env.RECOVERY_RETENTION_DAYS||7),batchSize=Number(process.env.RECOVERY_RETENTION_BATCH||100);
 if(!['PREVIEW','APPLY'].includes(mode)||!Number.isSafeInteger(retentionDays)||retentionDays<7||retentionDays>365||!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>1000)throw new Error('Invalid retention configuration');
 process.env.DATABASE_AUTO_MIGRATE='0';if(!process.env.DATABASE_URL)throw new Error('Dedicated PostgreSQL operator connection required');
 db=await openConfiguredDatabase();const role=(await db.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];if(!role||Object.values(role).some(Boolean))throw new Error('Restricted operator required');
 const grants=(await db.query("SELECT has_table_privilege(current_user,'novaworks.account_recovery_tokens','SELECT') AS can_read,has_table_privilege(current_user,'novaworks.account_recovery_tokens','DELETE') AS can_delete,has_any_column_privilege(current_user,'novaworks.account_recovery_tokens','UPDATE') AS can_rewrite")).rows[0];if(!grants?.can_read||!grants.can_delete||grants.can_rewrite)throw new Error('Dedicated retention privileges required');
 console.log(JSON.stringify(await createRecoveryRetention(db).run({mode,retentionDays,batchSize})));
}catch{console.error('Recovery retention failed; verify explicit mode, retention, migrations and dedicated restricted operator connection. No token values are logged.');process.exitCode=1;}finally{await db?.close();}
