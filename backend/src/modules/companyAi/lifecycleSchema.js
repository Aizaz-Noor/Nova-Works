// Additive upgrade: keep 009 and its checksum unchanged for existing companies.
export function companyAiLifecycleSql(prefix=''){
 const table=`${prefix}platform_ai_jobs`;
 return `ALTER TABLE ${table} ADD COLUMN discarded_at TEXT;
 ALTER TABLE ${table} ADD COLUMN discard_reason TEXT;
 ALTER TABLE ${table} ADD COLUMN redacted_at TEXT;
 CREATE INDEX platform_ai_jobs_pending ON ${table}(organization_id,status,discarded_at,created_at);`;
}
