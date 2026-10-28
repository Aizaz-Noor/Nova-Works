// Read-only preflight by default. --apply migrates only 025 after a current backup/rehearsal PASS.
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from '../backend/node_modules/pg/lib/index.js';
import {migratePlatform,migrations} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {captureSecurityMetadata,snapshotSchema,normalizeVersionHistory} from './current-release-utils.mjs';

async function main(){
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),privateDir=join(root,'tmp','release-private');
const envPath=process.argv[2],backupFolder=resolve(process.argv[3]||''),apply=process.argv.includes('--apply');
if(!envPath||!process.argv[3])throw new Error('Usage: node scripts/upgrade-current-hosted-release.mjs <private-operator-env-file> <current-backup-folder> [--apply]');
const backup=JSON.parse(await readFile(join(backupFolder,'results.json'),'utf8'));
assert.equal(backup.result,'PASS','Current full-schema backup and 025 rehearsal must pass first');
assert.equal(backup.hostedWrites,false);assert.ok(backup.checks?.some(text=>text.includes('025 rehearsal')));
const runtimeRecord=JSON.parse(await readFile(join(privateDir,'hosted-runtime.json'),'utf8'));
assert.equal(runtimeRecord.role,'novaworks_erp_web_20261024');assert.ok(runtimeRecord.DATABASE_URL,'Existing runtime configuration is missing');
const values=parseEnv(await readFile(envPath,'utf8')),address=new URL(values.DATABASE_URL);
assert.ok(`${address.hostname} ${decodeURIComponent(address.username)}`.includes('unwklbyuujmwoyztxrev'),'Hosted project identity mismatch');
for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])address.searchParams.delete(key);
const ca=await readFile(join(root,'backend/certs/supabase-root.pem'),'utf8');
const client=new pg.Client({connectionString:address.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15000,statement_timeout:120000});
const runtimeAddress=new URL(runtimeRecord.DATABASE_URL);assert.ok(`${runtimeAddress.hostname} ${decodeURIComponent(runtimeAddress.username)}`.includes('unwklbyuujmwoyztxrev'),'Runtime project identity mismatch');
for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])runtimeAddress.searchParams.delete(key);
const runtime=new pg.Client({connectionString:runtimeAddress.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15000,statement_timeout:30000});
const outputDir=join(privateDir,`hosted-025-${Date.now()}`);await mkdir(outputDir,{recursive:true,mode:0o700});await chmod(outputDir,0o700);
const evidence={result:'FAIL',target:'unwklbyuujmwoyztxrev',hostedWrites:false,mode:apply?'apply':'preflight',backupFolder,checks:[]};
const volatile=new Set(['sessions','request_limits']);let connected=false,runtimeConnected=false;
function stableBusiness(snapshot){return Object.fromEntries(Object.entries(snapshot).filter(([name])=>!volatile.has(name)));}
try{
 evidence.stage='hosted-read-only-preflight';
 await client.connect();connected=true;await client.query("SET TIME ZONE 'UTC'");
 const who=(await client.query('SELECT current_user name,session_user session,rolsuper,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.equal(who.name,'postgres');assert.equal(who.session,who.name);assert.equal(who.rolsuper,false);assert.equal(who.rolcreaterole,true);
 const migrationsNow=(await client.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 const prior=migrations.filter(item=>!item.version.startsWith('025_'));assert.equal(migrationsNow.length,prior.length,'Hosted schema must be exactly at migration 024');
 for(let index=0;index<prior.length;index++)assert.deepEqual(migrationsNow[index],{version:prior[index].version,checksum:createHash('sha256').update(prior[index].postgresSql).digest('hex')},'Hosted migration history/checksum changed');
 const beforeStaleCheck=await snapshotSchema(client);assert.deepEqual(stableBusiness(beforeStaleCheck),stableBusiness(backup.tables),'Business rows changed since the reviewed backup; take a fresh backup and rehearse again');
 evidence.checks.push('approved project, role, migration history, and nonvolatile business rows match the full-schema backup');
 const beforeSecurity=await captureSecurityMetadata(client);
 if(apply){
  evidence.stage='hosted-transaction-025';
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try{
   await client.query("SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='120s'");
   const insideBefore=await snapshotSchema(client);const insideBeforeNormalized=await snapshotSchema(client,{normalizeVersions:true});assert.deepEqual(stableBusiness(insideBefore),stableBusiness(backup.tables),'Business rows changed before transaction lock; refresh the backup');
   const adapter={kind:'postgres',query:(sql,args)=>client.query(sql,args),transaction:work=>work(client)};
   await migratePlatform(adapter);
   assert.deepEqual(await snapshotSchema(client,{normalizeVersions:true}),insideBeforeNormalized,'Unexpected row changes during additive 025 migration');
   const afterHistory=(await client.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
   assert.deepEqual(normalizeVersionHistory(afterHistory),migrationsNow,'Prior migration history changed');assert.equal(afterHistory.filter(row=>row.version==='025_project_task_versions').length,1);
   const afterSecurity=await captureSecurityMetadata(client);assert.deepEqual(afterSecurity,beforeSecurity,'025 changed security metadata, roles, grants, or policies');
   await client.query('COMMIT');evidence.hostedWrites=true;evidence.schemaCommitted=true;
   evidence.checks.push('025 committed in one transaction with all old rows and security metadata unchanged');
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 }
 const runtimeRole=runtimeRecord.role,runtimeUsername=decodeURIComponent(runtimeAddress.username);assert.ok(runtimeUsername===runtimeRole||runtimeUsername===`${runtimeRole}.unwklbyuujmwoyztxrev`,'Stored runtime URL must use its recorded restricted role');
 evidence.stage='existing-runtime-role-verification';
 await runtime.connect();runtimeConnected=true;
 if(apply){await assertPlatformRuntimeRole({kind:'postgres',query:(sql,args)=>runtime.query(sql,args)});evidence.checks.push('existing restricted hosted runtime passes current role, ownership, and RLS assertions after 025');}
 else {
  try{await assertPlatformRuntimeRole({kind:'postgres',query:(sql,args)=>runtime.query(sql,args)});evidence.checks.push('existing restricted hosted runtime passes current role, ownership, and RLS assertions');}
  catch(error){
   const expected='PostgreSQL runtime schema is missing project/task version columns; apply migration 025 before startup';
   if(error.message!==expected)throw error;
   evidence.runtimeBoundary='PRE_025_ONLY';evidence.checks.push('restricted runtime passed pre-025 boundary checks; expected missing 025 version columns remain pending');
  }
 }
 if(!apply){evidence.result='PASS';evidence.nextAction='Review preflight output, then rerun with --apply only while this backup remains current';}
 else {evidence.result='PASS';evidence.nextAction='No further database mutation is part of this helper';}
 console.log(JSON.stringify({result:evidence.result,mode:evidence.mode,hostedWrites:evidence.hostedWrites,checks:evidence.checks,nextAction:evidence.nextAction}));
}catch(error){evidence.failureCode=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'HOSTED_UPGRADE_PREFLIGHT_OR_MIGRATION_FAILED';evidence.failureStage=evidence.stage;console.error('Current hosted upgrade stopped:',evidence.failureStage,evidence.failureCode);process.exitCode=1;}
finally{
 if(runtimeConnected)await runtime.end().catch(()=>{});else await runtime.end().catch(()=>{});
 if(connected)await client.end().catch(()=>{});else await client.end().catch(()=>{});
 await writeFile(join(outputDir,'results.json'),JSON.stringify(evidence,null,2),{mode:0o600});
}
}

main().catch(()=>{console.error('Current hosted upgrade stopped: PRIVATE_CONFIGURATION_INVALID');process.exitCode=1;});
