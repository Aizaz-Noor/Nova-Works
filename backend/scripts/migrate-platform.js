import { openConfiguredDatabase } from '../src/db/database.js';
import { migratePlatform } from '../src/platform/migrations.js';
import { backfillDemoOrganization } from '../src/platform/backfill.js';

// Explicit CLI only: schema-owner secret is never consumed by the runtime server.
if(process.env.DATABASE_MIGRATION_URL)process.env.DATABASE_URL=process.env.DATABASE_MIGRATION_URL;
let db;
try {
 db = await openConfiguredDatabase();
 await migratePlatform(db);
 if(process.argv.includes('--backfill-demo')) await backfillDemoOrganization(db);
 console.log('ERP migrations applied and checksums verified.');
} catch {
 console.error('ERP migration failed. Preserve the backup; inspect migration configuration before retrying.');
 process.exitCode=1;
} finally { await db?.close(); }
