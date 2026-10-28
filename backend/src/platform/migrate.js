import { openConfiguredDatabase } from '../db/database.js';
import { migratePlatform } from './migrations.js';
import { backfillDemoOrganization } from './backfill.js';

const db=await openConfiguredDatabase();
try{
 await migratePlatform(db);
 console.log('Platform migrations applied and checksums verified.');
 if(process.argv.includes('--backfill-demo'))console.log(JSON.stringify(await backfillDemoOrganization(db)));
}finally{await db.close();}
