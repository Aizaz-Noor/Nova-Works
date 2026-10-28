// Read-only source; online backup restored into a new, exclusively created file.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,mkdtemp,copyFile,writeFile,constants} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {backupSqlite,validateBackup} from '../backend/scripts/backup-sqlite.js';

if(!process.argv[2])throw new Error('Usage: node scripts/verify-invoicing-restore.mjs <existing-local-test.sqlite>');
const source=resolve(process.argv[2]);await mkdir('tmp',{recursive:true});
const folder=await mkdtemp(resolve('tmp/invoicing-restore-'));
const tables=['users','platform_organizations','platform_memberships','platform_projects','platform_tasks','platform_customers','platform_contacts','platform_activities','platform_project_customers','platform_audit','platform_migrations','platform_pipeline_stages','platform_leads','platform_deals','platform_deal_projects','platform_quotes','platform_quote_items','platform_sales_orders','platform_sales_order_items','platform_time_entries','platform_time_approvals','platform_client_invoices','platform_invoice_items','platform_payment_records','platform_credit_notes','platform_invoice_counters'];
function snapshot(db){return Object.fromEntries(tables.map(table=>{const rows=db.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all();return[table,{count:rows.length,digest:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}];}));}
const original=new DatabaseSync(source,{readOnly:true});let restored;
try{
 const expected=snapshot(original);for(const table of ['platform_client_invoices','platform_invoice_items','platform_payment_records','platform_credit_notes','platform_invoice_counters'])assert.ok(expected[table].count>0,`Provide a test database with actual ${table} records`);
 const backup=join(folder,'backup.sqlite'),destination=join(folder,'restored.sqlite');
 const checks=await backupSqlite(source,backup);await copyFile(backup,destination,constants.COPYFILE_EXCL);
 restored=new DatabaseSync(destination,{readOnly:true});assert.deepEqual(snapshot(restored),expected);assert.deepEqual(validateBackup(destination),{integrity:'ok',foreignKeys:'ok'});
 const evidence={result:'PASS',onlineBackup:true,freshRestore:true,allBusinessRowsMatch:true,integrity:checks.integrity,foreignKeys:checks.foreignKeys,rowCounts:Object.fromEntries(Object.entries(expected).map(([table,value])=>[table,value.count]))};
 await writeFile(join(folder,'results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,evidenceFolder:folder},null,2));
}finally{restored?.close();original.close();}
