import pg from '../backend/node_modules/pg/lib/index.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {migrations,migratePlatform} from '../backend/src/platform/migrations.js';
const password=(await readFile('tmp/pg-portable/password.txt','utf8')).trim();
const config={host:'127.0.0.1',port:55439,user:'nw_test_admin',password,ssl:false};
const stamp=Date.now(),database=`nw_pipeline_upgrade_${stamp}`,role=`nw_migrator_${stamp}`;
const control=new pg.Client({...config,database:'postgres'});await control.connect();await control.query(`CREATE DATABASE ${database}`);await control.end();
const connection=new pg.Client({...config,database});await connection.connect();
const db={kind:'postgres',transaction:async work=>{await connection.query('BEGIN');try{const result=await work(connection);await connection.query('COMMIT');return result;}catch(error){await connection.query('ROLLBACK');throw error;}}};
try{
 await connection.query(await readFile('backend/migrations/001_postgres.sql','utf8'));
 const pending=migrations.splice(3);try{await migratePlatform(db);}finally{migrations.push(...pending);}
 await connection.query("INSERT INTO novaworks.users VALUES ('upgrade-owner','Owner','upgrade@example.test','hash','AGENT','','[]')");
 for(const id of ['old-alpha','old-beta'])await connection.query('INSERT INTO novaworks.platform_organizations VALUES ($1,$1,$2,$3)',[id,'upgrade-owner','baseline']);
 const before=(await connection.query('SELECT version,checksum FROM novaworks.platform_migrations ORDER BY version')).rows;
 await connection.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE,CREATE ON SCHEMA novaworks TO ${role}; GRANT ALL ON ALL TABLES IN SCHEMA novaworks TO ${role}; ALTER TABLE novaworks.platform_tasks OWNER TO ${role}; ALTER TABLE novaworks.platform_organizations OWNER TO ${role}; SET ROLE ${role}`);
 assert.equal((await connection.query('SELECT * FROM novaworks.platform_organizations')).rows.length,0);
 await migratePlatform(db);await migratePlatform(db);
 await connection.query('RESET ROLE');
 assert.deepEqual((await connection.query("SELECT version,checksum FROM novaworks.platform_migrations WHERE version < '005_pipeline' ORDER BY version")).rows,before);
 assert.equal((await connection.query('SELECT * FROM novaworks.platform_pipeline_stages')).rows.length,10);
 for(const table of ['organizations','pipeline_stages','leads','deals','deal_projects'])assert.equal((await connection.query('SELECT relforcerowsecurity FROM pg_class WHERE oid=$1::regclass',[`novaworks.platform_${table}`])).rows[0].relforcerowsecurity,true);
 const evidence={result:'PASS',migrationRole:'NOSUPERUSER NOBYPASSRLS',existingCompanies:2,seededStages:10,priorChecksumsPreserved:true,forcedRlsRestored:true,idempotent:true};await mkdir('tmp/pipeline-upgrade',{recursive:true});await writeFile('tmp/pipeline-upgrade/results.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await connection.end();}
