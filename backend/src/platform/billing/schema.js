export function billingSql(prefix=''){
 const t=name=>`${prefix}platform_${name}`;
 return `CREATE TABLE ${t('subscriptions')}(
 organization_id TEXT PRIMARY KEY REFERENCES ${t('organizations')}(id),plan_key TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELED','PAUSED','EXPIRED')),
 valid_until TEXT,past_due_since TEXT,provider_customer_id TEXT,provider_subscription_id TEXT UNIQUE,last_event_at TEXT,last_event_id TEXT,needs_reconciliation INTEGER NOT NULL DEFAULT 0 CHECK(needs_reconciliation IN (0,1)),version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE ${t('billing_events')}(
 organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),event_id TEXT NOT NULL,event_hash TEXT NOT NULL,occurred_at TEXT NOT NULL,event_type TEXT NOT NULL,outcome TEXT NOT NULL,received_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,event_id),UNIQUE(event_id));`;
}
export function billingRlsSql(){return ['subscriptions','billing_events'].map(name=>{
 const table=`novaworks.platform_${name}`,scope="organization_id=NULLIF(current_setting('app.organization_id',true),'')";
 return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
 ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
 CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
 CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
 ${name==='subscriptions'?`CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});`:''}
 REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');}
