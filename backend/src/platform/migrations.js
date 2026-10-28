import {memberLifecycleSql,memberLifecycleSqliteGuards,memberLifecyclePostgresSql} from './memberLifecycleSchema.js';
import {timeBillingSql,timeBillingPostgresSql} from '../modules/invoicing/timeBillingSchema.js';
import {billingRateSql,billingRateRlsSql,billingRateSqliteGuards} from '../modules/timesheets/billingRateSchema.js';
import {taskAttachmentSql,taskAttachmentRlsSql,taskAttachmentSqliteGuards} from './taskAttachments.js';
import {notificationSql,notificationRlsSql,notificationSqliteGuards} from './notifications.js';
import {milestoneSql,milestoneRlsSql} from '../modules/projects/milestoneSchema.js';
import {commentSql,commentSqliteGuards,commentRlsSql} from '../modules/projects/commentSchema.js';
import {mfaAuditSql,mfaAuditGuards,mfaAuditRls} from './mfa/audit.js';
import {mfaSql,mfaRlsSql} from './mfa/schema.js';
import {accountSecuritySql,accountSecuritySqliteGuards,accountSecurityRlsSql} from './accountSecurity.js';
import {recoverySql,recoveryRlsSql} from './recovery.js';
import {settingsSql,settingsRlsSql} from './settings.js';
import {reconciliationSql,reconciliationRlsSql} from './billing/reconciliationSchema.js';
import {billingSql,billingRlsSql} from './billing/schema.js';
import {companyAiLifecycleSql} from '../modules/companyAi/lifecycleSchema.js';
import {companyAiSql,companyAiRlsSql} from '../modules/companyAi/schema.js';
import {invoiceSql,invoiceSqliteGuards,invoicePostgresGuards,invoiceRlsSql} from '../modules/invoicing/schema.js';
import {timeSql,timeSqliteGuards,timePostgresGuards,timeRlsSql} from '../modules/timesheets/schema.js';
import {salesSql,salesSqliteGuards,salesPostgresGuards,salesRlsSql} from '../modules/sales/schema.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { crmSql,crmRlsSql } from '../modules/crm/schema.js';
import { pipelineSql,pipelineRlsSql } from '../modules/pipeline/schema.js';
import {projectTaskVersionSql,projectTaskVersionPostgresSql} from '../modules/projects/versionSchema.js';

// Separate namespace leaves the original public demo untouched. SQL is deliberately
// shared by both engines; money and ledger modules must introduce their own migrations.
export function foundationSql(prefix = '') {
 const t = name => `${prefix}platform_${name}`;
 return `
CREATE TABLE ${t('organizations')}(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES ${prefix}users(id),created_at TEXT NOT NULL);
CREATE TABLE ${t('memberships')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),user_id TEXT NOT NULL REFERENCES ${prefix}users(id),role TEXT NOT NULL CHECK(role IN ('OWNER','ADMIN','MANAGER','MEMBER')),created_at TEXT NOT NULL,PRIMARY KEY(organization_id,user_id));
CREATE TABLE ${t('projects')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,name TEXT NOT NULL,client_name TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',manager_id TEXT NOT NULL,deadline TEXT,status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','ACTIVE','DONE','ARCHIVED')),created_at TEXT NOT NULL,PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,manager_id) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE TABLE ${t('tasks')}(organization_id TEXT NOT NULL,id TEXT NOT NULL,project_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',assignee_id TEXT NOT NULL,deadline TEXT,estimated_hours DOUBLE PRECISION CHECK(estimated_hours>0),status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','IN_PROGRESS','DONE')),created_at TEXT NOT NULL,PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,project_id) REFERENCES ${t('projects')}(organization_id,id),FOREIGN KEY(organization_id,assignee_id) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE TABLE ${t('drafts')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,payload TEXT NOT NULL,created_by TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'DRAFT',created_at TEXT NOT NULL,PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE TABLE ${t('files')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,name TEXT NOT NULL,storage_key TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,storage_key),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE TABLE ${t('invitations')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('ADMIN','MANAGER','MEMBER')),token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,accepted_at TEXT,created_at TEXT NOT NULL,PRIMARY KEY(organization_id,id));
CREATE TABLE ${t('audit')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(organization_id,id));
CREATE INDEX platform_projects_manager ON ${t('projects')}(organization_id,manager_id);
CREATE INDEX platform_tasks_assignee ON ${t('tasks')}(organization_id,assignee_id);
`;
}

export function rlsSql() {
 const tables = ['organizations','memberships','projects','tasks','drafts','files','invitations','audit'];
 return tables.map(name => {
  const table = `novaworks.platform_${name}`;
  const tenant = `${name === 'organizations' ? 'id' : 'organization_id'} = NULLIF(current_setting('app.organization_id',true),'')`;
  // Discovery of one's memberships is needed BEFORE selecting a tenant. Organization
  // creation is permitted only for the server-authenticated identity in this transaction.
  const read = name === 'memberships' ? `(${tenant} OR user_id = NULLIF(current_setting('app.user_id',true),''))` : name === 'organizations' ? `(${tenant} OR created_by = NULLIF(current_setting('app.user_id',true),'') OR id IN (SELECT organization_id FROM novaworks.platform_memberships WHERE user_id = NULLIF(current_setting('app.user_id',true),'')))` : tenant;
  const write = name === 'organizations' ? `(${tenant} OR created_by = NULLIF(current_setting('app.user_id',true),''))` : tenant;
  return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${read});
CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${write});
CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${tenant}) WITH CHECK (${tenant});
CREATE POLICY tenant_delete ON ${table} FOR DELETE USING (${tenant});
REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');
}

export const migrations = [{ version: '002_tenant_foundation', sql: foundationSql(), postgresSql: foundationSql('novaworks.') + rlsSql() },
 {version:'003_ai_review',sql:'',postgresSql:readFileSync(new URL('../../migrations/003_ai_review.sql',import.meta.url),'utf8')},
 {version:'004_crm',sql:crmSql(),postgresSql:crmSql('novaworks.')+crmRlsSql()},
 {version:'005_pipeline',sql:pipelineSql(),postgresSql:pipelineSql('novaworks.')+pipelineRlsSql()},
 {version:'006_sales',sql:salesSql()+salesSqliteGuards(),postgresSql:salesSql('novaworks.')+salesPostgresGuards()+salesRlsSql()},
 {version:'007_timesheets',sql:timeSql()+timeSqliteGuards(),postgresSql:timeSql('novaworks.')+timePostgresGuards()+timeRlsSql()},
 {version:'008_invoicing',sql:invoiceSql()+invoiceSqliteGuards(),postgresSql:invoiceSql('novaworks.')+invoicePostgresGuards()+invoiceRlsSql()},
 {version:'009_company_ai',sql:companyAiSql(),postgresSql:companyAiSql('novaworks.')+companyAiRlsSql()},
 {version:'010_company_ai_lifecycle',sql:companyAiLifecycleSql(),postgresSql:companyAiLifecycleSql('novaworks.')},
 {version:'011_subscriptions',sql:billingSql(),postgresSql:billingSql('novaworks.')+billingRlsSql()},
 {version:'012_billing_reconciliation',sql:reconciliationSql(),postgresSql:reconciliationSql('novaworks.')+reconciliationRlsSql()},
 {version:'013_company_settings',sql:settingsSql(),postgresSql:settingsSql('novaworks.')+settingsRlsSql()},
 {version:'014_account_recovery',sql:recoverySql(),postgresSql:recoverySql('novaworks.')+recoveryRlsSql()},
 {version:'015_account_security_history',sql:accountSecuritySql()+accountSecuritySqliteGuards(),postgresSql:accountSecuritySql('novaworks.')+accountSecurityRlsSql()},
 {version:'016_account_mfa',sql:mfaSql(),postgresSql:mfaSql('novaworks.')+mfaRlsSql()},
 {version:'017_mfa_security_history',sql:mfaAuditSql()+mfaAuditGuards(),postgresSql:mfaAuditSql('novaworks.')+mfaAuditRls()},
 {version:'018_task_comments',sql:commentSql()+commentSqliteGuards(),postgresSql:commentSql('novaworks.')+commentRlsSql()},
 {version:'019_project_milestones',sql:milestoneSql(),postgresSql:milestoneSql('novaworks.')+milestoneRlsSql()},
 {version:'020_task_notifications',sql:notificationSql()+notificationSqliteGuards(),postgresSql:notificationSql('novaworks.')+notificationRlsSql()},
 {version:'021_task_attachments',sql:taskAttachmentSql()+taskAttachmentSqliteGuards(),postgresSql:taskAttachmentSql('novaworks.')+taskAttachmentRlsSql()},
 {version:'022_billing_rates',sql:billingRateSql()+billingRateSqliteGuards(),postgresSql:billingRateSql('novaworks.')+billingRateRlsSql()},
 {version:'023_time_billing',sql:timeBillingSql(),postgresSql:timeBillingPostgresSql()},
 {version:'024_member_lifecycle',sql:memberLifecycleSql()+memberLifecycleSqliteGuards(),postgresSql:memberLifecyclePostgresSql()},
 {version:'025_project_task_versions',sql:projectTaskVersionSql,postgresSql:projectTaskVersionPostgresSql}];

export async function migratePlatform(db) {
 const pg = db.kind === 'postgres';
 const history = pg ? 'novaworks.platform_migrations' : 'platform_migrations';
 const run = async connection => {
  const query = async (sql, values = []) => pg ? connection.query(sql, values) : { rows: db.prepare(sql).all(...values) };
  const exec = async sql => pg ? connection.query(sql) : db.exec(sql);
  await exec(`CREATE TABLE IF NOT EXISTS ${history}(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)`);
  for (const migration of migrations) {
   const sql = pg ? migration.postgresSql : migration.sql;
   const checksum = createHash('sha256').update(sql).digest('hex');
   const old = (await query(`SELECT checksum FROM ${history} WHERE version=${pg ? '$1' : '?'}`, [migration.version])).rows[0];
   if (old) { if (old.checksum !== checksum) throw new Error(`Migration checksum mismatch: ${migration.version}`); continue; }
   await exec(sql);
   const insert = `INSERT INTO ${history}(version,checksum,applied_at) VALUES (${pg ? '$1,$2,$3' : '?,?,?'})`;
   if (pg) await connection.query(insert, [migration.version, checksum, new Date().toISOString()]);
   else db.prepare(insert).run(migration.version, checksum, new Date().toISOString());
  }
 };
 if (pg) return db.transaction(async connection => { await connection.query("SELECT pg_advisory_xact_lock(hashtext('novaworks_platform_migrations'))"); await run(connection); });
 db.exec('BEGIN IMMEDIATE');
 try { await run(db); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
}
