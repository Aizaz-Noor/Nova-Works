export function billingRateSql(prefix='') {
 const t=n=>`${prefix}platform_${n}`;
 return `CREATE UNIQUE INDEX platform_project_customer_rate_reference ON ${t('project_customers')}(organization_id,project_id,customer_id);
CREATE TABLE ${t('billing_rates')} (
 organization_id TEXT NOT NULL,id TEXT NOT NULL,project_id TEXT NOT NULL,customer_id TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN ('USD','GBP','PKR')),hourly_minor BIGINT NOT NULL CHECK(hourly_minor>0 AND hourly_minor<=9007199254740991),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_by TEXT NOT NULL,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,created_by,request_id),UNIQUE(organization_id,project_id,currency),
 FOREIGN KEY(organization_id,project_id) REFERENCES ${t('projects')}(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,project_id,customer_id) REFERENCES ${t('project_customers')}(organization_id,project_id,customer_id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));`;
}
const immutable=['organization_id','id','project_id','customer_id','currency','created_by','request_id','request_hash','created_at'];
export function billingRateSqliteGuards(){return `CREATE TRIGGER platform_billing_rate_insert BEFORE INSERT ON platform_billing_rates WHEN typeof(NEW.hourly_minor)<>'integer' OR typeof(NEW.version)<>'integer' OR typeof(NEW.active)<>'integer' BEGIN SELECT RAISE(ABORT,'Billing rate values must be integers'); END;
CREATE TRIGGER platform_billing_rate_update BEFORE UPDATE ON platform_billing_rates WHEN typeof(NEW.hourly_minor)<>'integer' OR typeof(NEW.version)<>'integer' OR typeof(NEW.active)<>'integer' OR NEW.version<>OLD.version+1 OR (${immutable.map(k=>`NEW.${k} IS NOT OLD.${k}`).join(' OR ')}) BEGIN SELECT RAISE(ABORT,'Billing rate identity and version are immutable'); END;
CREATE TRIGGER platform_billing_rate_delete BEFORE DELETE ON platform_billing_rates BEGIN SELECT RAISE(ABORT,'Billing rates cannot be deleted'); END;`;}
export function billingRateRlsSql(){const table='novaworks.platform_billing_rates',scope="organization_id=NULLIF(current_setting('app.organization_id',true),'') AND EXISTS(SELECT 1 FROM novaworks.platform_memberships m WHERE m.organization_id=platform_billing_rates.organization_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.role IN ('OWNER','ADMIN'))";return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_rate_select ON ${table} FOR SELECT USING (${scope});
CREATE POLICY billing_rate_insert ON ${table} FOR INSERT WITH CHECK (${scope} AND created_by=NULLIF(current_setting('app.user_id',true),''));
CREATE POLICY billing_rate_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});
REVOKE ALL ON ${table} FROM PUBLIC;
CREATE FUNCTION novaworks.guard_billing_rate() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Billing rates cannot be deleted'; END IF; IF NEW.version<>OLD.version+1 OR (${immutable.map(k=>`NEW.${k} IS DISTINCT FROM OLD.${k}`).join(' OR ')}) THEN RAISE EXCEPTION 'Billing rate identity and version are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_billing_rate_guard BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION novaworks.guard_billing_rate();
REVOKE ALL ON FUNCTION novaworks.guard_billing_rate() FROM PUBLIC;`;}
