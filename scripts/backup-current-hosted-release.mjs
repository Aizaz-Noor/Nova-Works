// Read-only hosted snapshot plus isolated restore and 025 rehearsal. Never writes hosted data.
import {readFile,writeFile,mkdir,chmod,unlink} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from '../backend/node_modules/pg/lib/index.js';
import {migratePlatform,migrations} from '../backend/src/platform/migrations.js';
import {assertPlatformRuntimeRole} from '../backend/src/platform/runtime.js';
import {captureSecurityMetadata,compareMappedMetadata,snapshotSchema,normalizeVersionHistory,assertProtectedRoleMemberships} from './current-release-utils.mjs';

async function main(){
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),run=promisify(execFile),stamp=Date.now();
const envPath=process.argv[2];if(!envPath)throw new Error('Usage: node scripts/backup-current-hosted-release.mjs <private-operator-env-file>');
const privateDir=join(root,'tmp','release-private'),folder=join(privateDir,`current-hosted-release-${stamp}`);
const safeLog={result:'FAIL',target:'unwklbyuujmwoyztxrev',hostedWrites:false,stage:'preflight',folder};
const tools='E:/Projects/Hackathon/tmp/novaworks-analysis-20261019/tmp/pg-client-tools/pgsql/bin';
const password=(await readFile('E:/Projects/Hackathon/tmp/novaworks-analysis-20261019/tmp/pg-portable/password.txt','utf8')).trim();
const local={host:'127.0.0.1',port:5432,user:'nw_test_admin',password,ssl:false,connectionTimeoutMillis:10000};
const runtimeRecord=JSON.parse(await readFile(join(privateDir,'hosted-runtime.json'),'utf8'));
const runtimeRole=runtimeRecord.role;assert.equal(runtimeRole,'novaworks_erp_web_20261024');
const allowedRoles=new Set(['postgres','anon','authenticated','novaworks_member_lifecycle_guard',runtimeRole]);
const quote=value=>`"${String(value).replaceAll('"','""')}"`;
const privateEnv=parseEnv(await readFile(envPath,'utf8')),address=new URL(privateEnv.DATABASE_URL);
assert.ok(`${address.hostname} ${decodeURIComponent(address.username)}`.includes('unwklbyuujmwoyztxrev'),'Hosted project identity mismatch');
for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])address.searchParams.delete(key);
const ca=await readFile(join(root,'backend/certs/supabase-root.pem'),'utf8');
await mkdir(folder,{recursive:true,mode:0o700});await chmod(folder,0o700);
const hosted=new pg.Client({connectionString:address.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15000,statement_timeout:60000});
const hostEnv={...process.env,PGPASSWORD:decodeURIComponent(address.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:join(root,'backend/certs/supabase-root.pem')};
const archive=join(folder,'hosted-schema.dump'),opened=join(folder,'verify-opened.dump'),evidence={...safeLog,checks:[]};
let localAdmin,restored,rehearsalClient,sealed=false;
try{
 evidence.stage='hosted-read-only-snapshot';await hosted.connect();await hosted.query("SET TIME ZONE 'UTC'");await hosted.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const snapshotId=(await hosted.query('SELECT pg_export_snapshot() id')).rows[0].id;
 const before=await snapshotSchema(hosted);assert.ok(Object.keys(before).length>=50,'Hosted schema is incomplete or unexpected');evidence.tables=before;
 const history=(await hosted.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 const prior=migrations.filter(item=>!item.version.startsWith('025_'));
 assert.equal(prior.at(-1)?.version,'024_member_lifecycle');assert.equal(history.length,prior.length);
 for(let i=0;i<prior.length;i++)assert.deepEqual(history[i],{version:prior[i].version,checksum:createHash('sha256').update(prior[i].postgresSql).digest('hex')},'Hosted migration history differs from this source');
 assert.equal((await hosted.query("SELECT to_regclass('novaworks.platform_projects') IS NOT NULL AND to_regclass('novaworks.platform_tasks') IS NOT NULL AS ok")).rows[0].ok,true);
 const security=await captureSecurityMetadata(hosted);assert.ok(security.roleReferences.every(row=>allowedRoles.has(row.rolname)),'Unexpected role referenced by hosted schema');
 const roleByName=new Map(security.roles.map(row=>[row.rolname,row]));
 const guard=roleByName.get('novaworks_member_lifecycle_guard');assert.ok(guard&&!guard.rolcanlogin&&!guard.rolsuper&&!guard.rolcreatedb&&!guard.rolcreaterole&&!guard.rolinherit&&!guard.rolreplication&&!guard.rolbypassrls,'Unsafe lifecycle guard role');
 const web=roleByName.get(runtimeRole);assert.ok(web&&!web.rolsuper&&!web.rolcreaterole&&!web.rolcreatedb&&!web.rolbypassrls,'Unsafe runtime role');
 assertProtectedRoleMemberships(security.memberships,['novaworks_member_lifecycle_guard',runtimeRole]);
 await writeFile(join(folder,'hosted-security-metadata.json'),JSON.stringify(security,null,2),{mode:0o600});
 evidence.stage='hosted-schema-dump';await run(join(tools,'pg_dump.exe'),['--host',address.hostname,'--port',address.port||'5432','--username',decodeURIComponent(address.username),'--dbname',address.pathname.slice(1),'--no-password','--format=custom','--schema=novaworks',`--snapshot=${snapshotId}`,'--file',archive],{env:hostEnv,timeout:180000,maxBuffer:1024*1024,windowsHide:true});
 await chmod(archive,0o600);await hosted.query('COMMIT');evidence.checks.push('TLS-verified repeatable read-only snapshot and native custom-format schema dump');
 const raw=await readFile(archive),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(raw),cipher.final()]);
 const protect=`Add-Type -AssemblyName System.Security; $raw=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($raw,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`;
 const wrapped=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',protect],{input:key.toString('base64'),encoding:'utf8',windowsHide:true}).trim();
 await writeFile(join(folder,'hosted-schema.dump.enc'),Buffer.concat([iv,cipher.getAuthTag(),encrypted]),{mode:0o600});await writeFile(join(folder,'archive-key.dpapi'),wrapped,{mode:0o600});
 const sealedBytes=await readFile(join(folder,'hosted-schema.dump.enc')),wrappedKey=await readFile(join(folder,'archive-key.dpapi'),'utf8');
 const unprotect=`Add-Type -AssemblyName System.Security; $w=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($w,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`;
 const recoveredKey=Buffer.from(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',unprotect],{input:wrappedKey,encoding:'utf8',windowsHide:true}).trim(),'base64');
 const decipher=createDecipheriv('aes-256-gcm',recoveredKey,sealedBytes.subarray(0,12));decipher.setAuthTag(sealedBytes.subarray(12,28));const recoveredBytes=Buffer.concat([decipher.update(sealedBytes.subarray(28)),decipher.final()]);
 const archiveSha256=createHash('sha256').update(raw).digest('hex');assert.equal(createHash('sha256').update(recoveredBytes).digest('hex'),archiveSha256);await writeFile(opened,recoveredBytes,{mode:0o600});await unlink(archive);sealed=true;
 evidence.archiveSha256=archiveSha256;evidence.encryption='AES-256-GCM; key DPAPI-wrapped to current Windows user';evidence.checks.push('encrypted archive reopened and authenticated');
 evidence.stage='isolated-role-preparation';localAdmin=new pg.Client({...local,database:'postgres'});await localAdmin.connect();
 const localRoleRows=(await localAdmin.query('SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])',[security.roleReferences.map(row=>row.rolname)])).rows;
 const localRoles=new Set(localRoleRows.map(row=>row.rolname));
 for(const {rolname:name} of security.roleReferences){
  if(localRoles.has(name))continue;
  assert.ok(allowedRoles.has(name),'Unapproved role would be created');
  await localAdmin.query(`CREATE ROLE ${quote(name)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  evidence.localRolesCreated=(evidence.localRolesCreated||[]).concat(name);
 }
 const db=`nw_current_restore_${stamp}`;assert.match(db,/^nw_current_restore_\d+$/);await localAdmin.query(`CREATE DATABASE ${quote(db)}`);
 evidence.stage='isolated-native-restore';await run(join(tools,'pg_restore.exe'),['--host',local.host,'--port',String(local.port),'--username',local.user,'--dbname',db,'--no-password','--exit-on-error',opened],{env:{...process.env,PGPASSWORD:password,PGSSLMODE:'disable'},timeout:180000,maxBuffer:1024*1024,windowsHide:true});
 restored=new pg.Client({...local,database:db});await restored.connect();await restored.query("SET TIME ZONE 'UTC'");
 const restoredRows=await snapshotSchema(restored);assert.deepEqual(restoredRows,before,'Restored schema row counts/digests differ from hosted snapshot');
 const restoredSecurity=await captureSecurityMetadata(restored);
 assert.ok(compareMappedMetadata(security,restoredSecurity),'Restored security metadata differs from hosted snapshot');
 evidence.checks.push('fresh named loopback restore matches every schema table count and row digest');evidence.checks.push('native owner and ACL restore preserves RLS, policies, functions and referenced-role names; no owner remapping');
 evidence.stage='isolated-025-rehearsal';rehearsalClient=new pg.Client({...local,database:db});await rehearsalClient.connect();
 const localAdapter={kind:'postgres',query:(sql,args)=>rehearsalClient.query(sql,args),transaction:work=>work(rehearsalClient)};
 const historyBefore=(await rehearsalClient.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 const normalizedBefore=await snapshotSchema(rehearsalClient,{normalizeVersions:true});
 await rehearsalClient.query('BEGIN');try{await migratePlatform(localAdapter);await rehearsalClient.query('COMMIT');}catch(error){await rehearsalClient.query('ROLLBACK');throw error;}
 const historyAfter=(await rehearsalClient.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 assert.deepEqual(normalizeVersionHistory(historyAfter),historyBefore);assert.ok(historyAfter.some(row=>row.version==='025_project_task_versions'));
 assert.deepEqual(await snapshotSchema(rehearsalClient,{normalizeVersions:true}),normalizedBefore,'025 rehearsal changed historical data');
 assert.equal((await rehearsalClient.query('SELECT COUNT(*)::int count FROM novaworks.platform_projects WHERE version<>1')).rows[0].count,0);
 assert.equal((await rehearsalClient.query('SELECT COUNT(*)::int count FROM novaworks.platform_tasks WHERE version<>1')).rows[0].count,0);
 evidence.checks.push('025 rehearsal preserves every previous migration checksum and row digest; only default revision columns and migration history are added');
 const roleExists=(await rehearsalClient.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[runtimeRole])).rowCount===1;
 if(roleExists){await rehearsalClient.query(`SET ROLE ${quote(runtimeRole)}`);try{await assertPlatformRuntimeRole(localAdapter);}finally{await rehearsalClient.query('RESET ROLE');}evidence.checks.push('existing restricted runtime role passes post-upgrade assertions via local SET ROLE');}
 else {await rehearsalClient.query(`CREATE ROLE ${quote(runtimeRole)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`);await rehearsalClient.query(`SET ROLE ${quote(runtimeRole)}`);try{await assertPlatformRuntimeRole(localAdapter);}finally{await rehearsalClient.query('RESET ROLE');}evidence.checks.push('reviewed missing runtime role created locally as NOLOGIN and passes post-upgrade SET ROLE assertions');}
 await rehearsalClient.query('BEGIN');try{await migratePlatform(localAdapter);await rehearsalClient.query('COMMIT');}catch(error){await rehearsalClient.query('ROLLBACK');throw error;}
 assert.deepEqual(await snapshotSchema(rehearsalClient,{normalizeVersions:true}),normalizedBefore);evidence.checks.push('025 repeat migration is a no-op');
 evidence.schemaTables=Object.keys(before).length;evidence.migrations=historyBefore.length;evidence.result='PASS';
 console.log(JSON.stringify({result:evidence.result,folder,localDatabase:db,schemaTables:evidence.schemaTables,checks:evidence.checks}));
}catch(error){evidence.failureCode=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'BACKUP_OR_RESTORE_FAILED';evidence.failureStage=evidence.stage;console.error('Current hosted backup/rehearsal failed:',evidence.failureCode);process.exitCode=1;}
finally{
 try{await hosted.query('ROLLBACK')}catch{}await hosted.end().catch(()=>{});await rehearsalClient?.end().catch(()=>{});await restored?.end().catch(()=>{});await localAdmin?.end().catch(()=>{});
 for(const file of [archive,opened])try{await unlink(file)}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(join(folder,'results.json'),JSON.stringify(evidence,null,2),{mode:0o600});
}
}

main().catch(()=>{console.error('Current hosted backup/rehearsal stopped: PRIVATE_CONFIGURATION_INVALID');process.exitCode=1;});
