export const defaultStages=[['NEW','New',1],['QUALIFIED','Qualified',2],['PROPOSAL','Proposal',3],['WON','Won',4],['LOST','Lost',5]];
export async function seedPipelineStages(context,prefix=''){
 for(const [code,name,position] of defaultStages)await context.query(`INSERT INTO ${prefix}platform_pipeline_stages(organization_id,code,name,position) VALUES (?,?,?,?) ON CONFLICT(organization_id,code) DO NOTHING`,[context.organizationId,code,name,position]);
}
export function pipelineSql(prefix=''){
 const t=name=>`${prefix}platform_${name}`;
 return `
CREATE TABLE ${t('pipeline_stages')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),code TEXT NOT NULL CHECK(code IN ('NEW','QUALIFIED','PROPOSAL','WON','LOST')),name TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(organization_id,code),UNIQUE(organization_id,position));
CREATE TABLE ${t('leads')}(
 organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),id TEXT NOT NULL,name TEXT NOT NULL,company_name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',owner_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','QUALIFIED','DISQUALIFIED','CONVERTED')),follow_up_on TEXT,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),converted_customer_id TEXT,converted_contact_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,converted_customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,converted_contact_id) REFERENCES ${t('contacts')}(organization_id,id));
CREATE TABLE ${t('deals')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,source_lead_id TEXT,name TEXT NOT NULL,owner_id TEXT NOT NULL,stage_code TEXT NOT NULL DEFAULT 'NEW',amount_minor BIGINT CHECK(amount_minor>=0 AND amount_minor<=9007199254740991),currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','GBP','PKR')),expected_close_on TEXT,notes TEXT NOT NULL DEFAULT '',lost_reason TEXT NOT NULL DEFAULT '',closed_at TEXT,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source_lead_id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,source_lead_id) REFERENCES ${t('leads')}(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,stage_code) REFERENCES ${t('pipeline_stages')}(organization_id,code));
CREATE TABLE ${t('deal_projects')}(
 organization_id TEXT NOT NULL,deal_id TEXT NOT NULL,project_id TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,deal_id),UNIQUE(organization_id,project_id),FOREIGN KEY(organization_id,deal_id) REFERENCES ${t('deals')}(organization_id,id),FOREIGN KEY(organization_id,project_id) REFERENCES ${t('projects')}(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE INDEX platform_leads_status ON ${t('leads')}(organization_id,status,created_at,id);
CREATE INDEX platform_leads_owner ON ${t('leads')}(organization_id,owner_id);
CREATE INDEX platform_deals_stage ON ${t('deals')}(organization_id,stage_code,created_at,id);
CREATE INDEX platform_deals_customer ON ${t('deals')}(organization_id,customer_id);
${prefix?`ALTER TABLE ${t('organizations')} NO FORCE ROW LEVEL SECURITY;`:''}
${defaultStages.map(([code,name,position])=>`INSERT INTO ${t('pipeline_stages')}(organization_id,code,name,position) SELECT id,'${code}','${name}',${position} FROM ${t('organizations')};`).join('\n')}
${prefix?`ALTER TABLE ${t('organizations')} FORCE ROW LEVEL SECURITY;`:''}
`;
}
export function pipelineRlsSql(){return ['pipeline_stages','leads','deals','deal_projects'].map(name=>{
 const table=`novaworks.platform_${name}`,scope="organization_id = NULLIF(current_setting('app.organization_id',true),'')";
 return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
${['leads','deals'].includes(name)?`CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});`:''}
REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');}
