export const salesTables=['quotes','quote_items','sales_orders','sales_order_items'];
export function salesSql(prefix=''){
 const t=name=>`${prefix}platform_${name}`;
 return `
CREATE TABLE ${t('quotes')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,deal_id TEXT,owner_id TEXT NOT NULL,title TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN ('USD','GBP','PKR')),terms TEXT NOT NULL DEFAULT '',valid_until TEXT,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','ACCEPTED','DECLINED','SUPERSEDED')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),supersedes_quote_id TEXT,
 customer_name TEXT NOT NULL,customer_email TEXT NOT NULL DEFAULT '',subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL CHECK(total_minor>=0 AND total_minor<=9007199254740991),
 issued_at TEXT,accepted_at TEXT,accepted_by TEXT,approval_reference TEXT NOT NULL DEFAULT '',decline_reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,supersedes_quote_id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,deal_id) REFERENCES ${t('deals')}(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,accepted_by) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,supersedes_quote_id) REFERENCES ${t('quotes')}(organization_id,id));
CREATE TABLE ${t('quote_items')}(
 organization_id TEXT NOT NULL,quote_id TEXT NOT NULL,position INTEGER NOT NULL,description TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0 AND quantity<=1000000),unit_minor BIGINT NOT NULL CHECK(unit_minor>=0),tax_rate_bps INTEGER NOT NULL CHECK(tax_rate_bps>=0 AND tax_rate_bps<=10000),subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,
 PRIMARY KEY(organization_id,quote_id,position),FOREIGN KEY(organization_id,quote_id) REFERENCES ${t('quotes')}(organization_id,id));
CREATE TABLE ${t('sales_orders')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,quote_id TEXT NOT NULL,quote_version INTEGER NOT NULL,customer_id TEXT NOT NULL,deal_id TEXT,owner_id TEXT NOT NULL,title TEXT NOT NULL,currency TEXT NOT NULL,terms TEXT NOT NULL,valid_until TEXT,customer_name TEXT NOT NULL,customer_email TEXT NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,accepted_at TEXT NOT NULL,accepted_by TEXT NOT NULL,approval_reference TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,quote_id),FOREIGN KEY(organization_id,quote_id) REFERENCES ${t('quotes')}(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,deal_id) REFERENCES ${t('deals')}(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,accepted_by) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE TABLE ${t('sales_order_items')}(
 organization_id TEXT NOT NULL,order_id TEXT NOT NULL,position INTEGER NOT NULL,description TEXT NOT NULL,quantity INTEGER NOT NULL,unit_minor BIGINT NOT NULL,tax_rate_bps INTEGER NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,
 PRIMARY KEY(organization_id,order_id,position),FOREIGN KEY(organization_id,order_id) REFERENCES ${t('sales_orders')}(organization_id,id));
CREATE INDEX platform_quotes_list ON ${t('quotes')}(organization_id,status,created_at,id);
CREATE INDEX platform_sales_orders_list ON ${t('sales_orders')}(organization_id,created_at,id);
`;
}
const transition="(OLD.status='DRAFT' AND NEW.status IN ('DRAFT','ISSUED')) OR (OLD.status='ISSUED' AND NEW.status IN ('ACCEPTED','DECLINED','SUPERSEDED')) OR (OLD.status='DECLINED' AND NEW.status='SUPERSEDED')";
const frozen=['customer_id','deal_id','owner_id','title','currency','terms','valid_until','customer_name','customer_email','subtotal_minor','tax_minor','total_minor','supersedes_quote_id','issued_at'];
export function salesSqliteGuards(){return `
CREATE TRIGGER platform_quote_lifecycle BEFORE UPDATE ON platform_quotes WHEN NOT (${transition}) BEGIN SELECT RAISE(ABORT,'Invalid quote transition'); END;
CREATE TRIGGER platform_quote_terms BEFORE UPDATE ON platform_quotes WHEN OLD.status<>'DRAFT' AND (${frozen.map(key=>`OLD.${key} IS NOT NEW.${key}`).join(' OR ')}) BEGIN SELECT RAISE(ABORT,'Issued quote terms are immutable'); END;
${['INSERT','UPDATE','DELETE'].map(op=>`CREATE TRIGGER platform_quote_items_${op.toLowerCase()} BEFORE ${op} ON platform_quote_items WHEN (SELECT status FROM platform_quotes WHERE organization_id=${op==='DELETE'?'OLD':'NEW'}.organization_id AND id=${op==='DELETE'?'OLD':'NEW'}.quote_id)<>'DRAFT' ${op==='UPDATE'?"OR (SELECT status FROM platform_quotes WHERE organization_id=OLD.organization_id AND id=OLD.quote_id)<>'DRAFT'":''} BEGIN SELECT RAISE(ABORT,'Issued quote items are immutable'); END;`).join('\n')}
${['sales_orders','sales_order_items'].flatMap(name=>['UPDATE','DELETE'].map(op=>`CREATE TRIGGER platform_${name}_${op.toLowerCase()} BEFORE ${op} ON platform_${name} BEGIN SELECT RAISE(ABORT,'Sales orders are immutable'); END;`)).join('\n')}
`;}
export function salesPostgresGuards(){return `
CREATE FUNCTION novaworks.guard_quote_terms() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NOT (${transition}) THEN RAISE EXCEPTION 'Invalid quote transition'; END IF; IF OLD.status<>'DRAFT' AND (${frozen.map(key=>`OLD.${key} IS DISTINCT FROM NEW.${key}`).join(' OR ')}) THEN RAISE EXCEPTION 'Issued quote terms are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_quote_terms BEFORE UPDATE ON novaworks.platform_quotes FOR EACH ROW EXECUTE FUNCTION novaworks.guard_quote_terms();
CREATE FUNCTION novaworks.guard_quote_items() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP IN ('UPDATE','DELETE') AND EXISTS(SELECT 1 FROM novaworks.platform_quotes WHERE organization_id=OLD.organization_id AND id=OLD.quote_id AND status<>'DRAFT') THEN RAISE EXCEPTION 'Issued quote items are immutable'; END IF;
 IF TG_OP IN ('UPDATE','INSERT') AND EXISTS(SELECT 1 FROM novaworks.platform_quotes WHERE organization_id=NEW.organization_id AND id=NEW.quote_id AND status<>'DRAFT') THEN RAISE EXCEPTION 'Issued quote items are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_quote_items_guard BEFORE INSERT OR UPDATE OR DELETE ON novaworks.platform_quote_items FOR EACH ROW EXECUTE FUNCTION novaworks.guard_quote_items();
CREATE FUNCTION novaworks.guard_sales_order() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Sales orders are immutable'; END $$;
CREATE TRIGGER platform_sales_order_guard BEFORE UPDATE OR DELETE ON novaworks.platform_sales_orders FOR EACH ROW EXECUTE FUNCTION novaworks.guard_sales_order();
CREATE TRIGGER platform_sales_order_items_guard BEFORE UPDATE OR DELETE ON novaworks.platform_sales_order_items FOR EACH ROW EXECUTE FUNCTION novaworks.guard_sales_order();
REVOKE ALL ON FUNCTION novaworks.guard_quote_terms(),novaworks.guard_quote_items(),novaworks.guard_sales_order() FROM PUBLIC;
`;}
export function salesRlsSql(){return salesTables.map(name=>{
 const table=`novaworks.platform_${name}`,scope="organization_id=NULLIF(current_setting('app.organization_id',true),'')";
 return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
${['quotes','quote_items'].includes(name)?`CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});`:''}
${name==='quote_items'?`CREATE POLICY tenant_delete ON ${table} FOR DELETE USING (${scope});`:''}
REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');}
