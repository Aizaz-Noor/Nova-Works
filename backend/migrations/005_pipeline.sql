-- Review reference. Apply through db:migrate:erp to record version/checksum.

CREATE TABLE novaworks.platform_pipeline_stages(organization_id TEXT NOT NULL REFERENCES novaworks.platform_organizations(id),code TEXT NOT NULL CHECK(code IN ('NEW','QUALIFIED','PROPOSAL','WON','LOST')),name TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(organization_id,code),UNIQUE(organization_id,position));
CREATE TABLE novaworks.platform_leads(
 organization_id TEXT NOT NULL REFERENCES novaworks.platform_organizations(id),id TEXT NOT NULL,name TEXT NOT NULL,company_name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',owner_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','QUALIFIED','DISQUALIFIED','CONVERTED')),follow_up_on TEXT,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),converted_customer_id TEXT,converted_contact_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,converted_customer_id) REFERENCES novaworks.platform_customers(organization_id,id),FOREIGN KEY(organization_id,converted_contact_id) REFERENCES novaworks.platform_contacts(organization_id,id));
CREATE TABLE novaworks.platform_deals(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,source_lead_id TEXT,name TEXT NOT NULL,owner_id TEXT NOT NULL,stage_code TEXT NOT NULL DEFAULT 'NEW',amount_minor BIGINT CHECK(amount_minor>=0 AND amount_minor<=9007199254740991),currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','GBP','PKR')),expected_close_on TEXT,notes TEXT NOT NULL DEFAULT '',lost_reason TEXT NOT NULL DEFAULT '',closed_at TEXT,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source_lead_id),FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),FOREIGN KEY(organization_id,source_lead_id) REFERENCES novaworks.platform_leads(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,stage_code) REFERENCES novaworks.platform_pipeline_stages(organization_id,code));
CREATE TABLE novaworks.platform_deal_projects(
 organization_id TEXT NOT NULL,deal_id TEXT NOT NULL,project_id TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,deal_id),UNIQUE(organization_id,project_id),FOREIGN KEY(organization_id,deal_id) REFERENCES novaworks.platform_deals(organization_id,id),FOREIGN KEY(organization_id,project_id) REFERENCES novaworks.platform_projects(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE INDEX platform_leads_status ON novaworks.platform_leads(organization_id,status,created_at,id);
CREATE INDEX platform_leads_owner ON novaworks.platform_leads(organization_id,owner_id);
CREATE INDEX platform_deals_stage ON novaworks.platform_deals(organization_id,stage_code,created_at,id);
CREATE INDEX platform_deals_customer ON novaworks.platform_deals(organization_id,customer_id);
ALTER TABLE novaworks.platform_organizations NO FORCE ROW LEVEL SECURITY;
INSERT INTO novaworks.platform_pipeline_stages(organization_id,code,name,position) SELECT id,'NEW','New',1 FROM novaworks.platform_organizations;
INSERT INTO novaworks.platform_pipeline_stages(organization_id,code,name,position) SELECT id,'QUALIFIED','Qualified',2 FROM novaworks.platform_organizations;
INSERT INTO novaworks.platform_pipeline_stages(organization_id,code,name,position) SELECT id,'PROPOSAL','Proposal',3 FROM novaworks.platform_organizations;
INSERT INTO novaworks.platform_pipeline_stages(organization_id,code,name,position) SELECT id,'WON','Won',4 FROM novaworks.platform_organizations;
INSERT INTO novaworks.platform_pipeline_stages(organization_id,code,name,position) SELECT id,'LOST','Lost',5 FROM novaworks.platform_organizations;
ALTER TABLE novaworks.platform_organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_pipeline_stages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_pipeline_stages FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_pipeline_stages FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_pipeline_stages FROM PUBLIC;
ALTER TABLE novaworks.platform_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_leads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_leads FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_leads FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_leads FOR UPDATE USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_leads FROM PUBLIC;
ALTER TABLE novaworks.platform_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_deals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_deals FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_deals FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_deals FOR UPDATE USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_deals FROM PUBLIC;
ALTER TABLE novaworks.platform_deal_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_deal_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_deal_projects FOR SELECT USING (organization_id = NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_deal_projects FOR INSERT WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_deal_projects FROM PUBLIC;