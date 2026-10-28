export function crmSql(prefix='') {
 const table=name=>`${prefix}platform_${name}`;
 return `
CREATE TABLE ${table('customers')}(
 organization_id TEXT NOT NULL REFERENCES ${table('organizations')}(id),id TEXT NOT NULL,
 name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',website TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'PROSPECT' CHECK(status IN ('PROSPECT','ACTIVE','ARCHIVED')),owner_id TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES ${table('memberships')}(organization_id,user_id));
CREATE TABLE ${table('contacts')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,name TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',job_title TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${table('customers')}(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES ${table('memberships')}(organization_id,user_id));
CREATE TABLE ${table('activities')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('NOTE','CALL','MEETING')),
 body TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${table('customers')}(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES ${table('memberships')}(organization_id,user_id));
CREATE INDEX platform_customers_status ON ${table('customers')}(organization_id,status,created_at,id);
CREATE INDEX platform_customers_owner ON ${table('customers')}(organization_id,owner_id);
CREATE INDEX platform_contacts_customer ON ${table('contacts')}(organization_id,customer_id,created_at,id);
CREATE INDEX platform_activities_customer ON ${table('activities')}(organization_id,customer_id,created_at,id);
CREATE TABLE ${table('project_customers')}(
 organization_id TEXT NOT NULL,project_id TEXT NOT NULL,customer_id TEXT NOT NULL,linked_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,project_id),FOREIGN KEY(organization_id,project_id) REFERENCES ${table('projects')}(organization_id,id),
 FOREIGN KEY(organization_id,customer_id) REFERENCES ${table('customers')}(organization_id,id),
 FOREIGN KEY(organization_id,linked_by) REFERENCES ${table('memberships')}(organization_id,user_id));
CREATE INDEX platform_project_customers_customer ON ${table('project_customers')}(organization_id,customer_id);
`;
}

export function crmRlsSql() {
 return ['customers','contacts','activities','project_customers'].map(name=>{
  const table=`novaworks.platform_${name}`;
  const tenant="organization_id = NULLIF(current_setting('app.organization_id',true),'')";
  return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${tenant});
CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${tenant});
CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${tenant}) WITH CHECK (${tenant});
CREATE POLICY tenant_delete ON ${table} FOR DELETE USING (${tenant});
REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');
}
