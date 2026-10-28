export function reconciliationSql(prefix=''){
 const t=name=>`${prefix}platform_${name}`;
 return `ALTER TABLE ${t('subscriptions')} ADD COLUMN provider_updated_at TEXT;
 CREATE TABLE ${t('billing_operations')}(
 organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),request_id TEXT NOT NULL,operation TEXT NOT NULL CHECK(operation IN ('PROVISION','RECONCILE','REPLACE')),requested_subscription_id TEXT NOT NULL,previous_subscription_id TEXT,created_by TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('RUNNING','COMPLETE','FAILED')),attempts INTEGER NOT NULL DEFAULT 1,lease_token TEXT,lease_until TEXT,base_version INTEGER NOT NULL,result_json TEXT,error_code TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(organization_id,request_id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));
 CREATE INDEX platform_billing_operations_recent ON ${t('billing_operations')}(organization_id,updated_at);`;
}
export function reconciliationRlsSql(){const table='novaworks.platform_billing_operations',scope="organization_id=NULLIF(current_setting('app.organization_id',true),'')";return `
 ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
 ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
 CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
 CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
 CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});
 REVOKE ALL ON ${table} FROM PUBLIC;`;}
