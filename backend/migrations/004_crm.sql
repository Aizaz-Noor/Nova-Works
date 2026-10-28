-- Review reference. Apply through db:migrate:erp to record version/checksum.

CREATE TABLE novaworks.platform_customers(
 organization_id TEXT NOT NULL REFERENCES novaworks.platform_organizations(id),id TEXT NOT NULL,
 name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',website TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'PROSPECT' CHECK(status IN ('PROSPECT','ACTIVE','ARCHIVED')),owner_id TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE TABLE novaworks.platform_contacts(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,name TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',job_title TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE TABLE novaworks.platform_activities(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('NOTE','CALL','MEETING')),
 body TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE INDEX platform_customers_status ON novaworks.platform_customers(organization_id,status,created_at,id);
CREATE INDEX platform_customers_owner ON novaworks.platform_customers(organization_id,owner_id);
CREATE INDEX platform_contacts_customer ON novaworks.platform_contacts(organization_id,customer_id,created_at,id);
CREATE INDEX platform_activities_customer ON novaworks.platform_activities(organization_id,customer_id,created_at,id);
CREATE TABLE novaworks.platform_project_customers(
 organization_id TEXT NOT NULL,project_id TEXT NOT NULL,customer_id TEXT NOT NULL,linked_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,project_id),FOREIGN KEY(organization_id,project_id) REFERENCES novaworks.platform_projects(organization_id,id),
 FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),
 FOREIGN KEY(organization_id,linked_by) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE INDEX platform_project_customers_customer ON novaworks.platform_project_customers(organization_id,customer_id);
ALTER TABLE novaworks.platform_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_customers FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_customers FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_customers FOR UPDATE USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_delete ON novaworks.platform_customers FOR DELETE USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_customers FROM PUBLIC;
ALTER TABLE novaworks.platform_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_contacts FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_contacts FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_contacts FOR UPDATE USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_delete ON novaworks.platform_contacts FOR DELETE USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_contacts FROM PUBLIC;
ALTER TABLE novaworks.platform_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_activities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_activities FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_activities FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_activities FOR UPDATE USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_delete ON novaworks.platform_activities FOR DELETE USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_activities FROM PUBLIC;
ALTER TABLE novaworks.platform_project_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_project_customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_project_customers FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_project_customers FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_project_customers FOR UPDATE USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_delete ON novaworks.platform_project_customers FOR DELETE USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_project_customers FROM PUBLIC;
