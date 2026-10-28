export function companyAiSql(prefix='') {
 const t=name=>`${prefix}platform_${name}`;
 return `CREATE TABLE ${t('ai_jobs')}(
 organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,
 request_id TEXT NOT NULL,request_hash TEXT NOT NULL,transcript TEXT NOT NULL,
 created_by TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('QUEUED','RUNNING','REVIEW','FAILED','APPROVED')),
 version INTEGER NOT NULL DEFAULT 1,attempts INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,lease_until TEXT,draft_json TEXT,issues_json TEXT,result_json TEXT,error_code TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,request_id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));
 CREATE INDEX platform_ai_jobs_created ON ${t('ai_jobs')}(organization_id,created_at,id);
 CREATE TABLE ${t('ai_usage')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),day TEXT NOT NULL,attempts INTEGER NOT NULL CHECK(attempts>=0),PRIMARY KEY(organization_id,day));`;
}
export function companyAiRlsSql(){return ['ai_jobs','ai_usage'].map(name=>{
 const table=`novaworks.platform_${name}`,scope="organization_id=NULLIF(current_setting('app.organization_id',true),'')";
 return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
 ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
 CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
 CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
 CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});
 REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');}
