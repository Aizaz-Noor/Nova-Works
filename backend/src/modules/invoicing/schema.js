export const invoiceTables=['client_invoices','invoice_items','payment_records','credit_notes','invoice_counters'];
export function invoiceSql(prefix=''){
 const t=name=>`${prefix}platform_${name}`;
 return `
CREATE TABLE ${t('invoice_counters')}(organization_id TEXT NOT NULL REFERENCES ${t('organizations')}(id),kind TEXT NOT NULL CHECK(kind IN ('INVOICE','CREDIT')),next_value INTEGER NOT NULL CHECK(next_value>=1 AND next_value<=1000000000),PRIMARY KEY(organization_id,kind));
CREATE TABLE ${t('client_invoices')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,sales_order_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>=1),supersedes_invoice_id TEXT,created_by TEXT NOT NULL,customer_id TEXT NOT NULL,title TEXT NOT NULL,currency TEXT NOT NULL,terms TEXT NOT NULL,customer_name TEXT NOT NULL,customer_email TEXT NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL CHECK(total_minor>=0 AND total_minor<=9007199254740991),
 issuer_name TEXT NOT NULL,issuer_address TEXT NOT NULL DEFAULT '',customer_address TEXT NOT NULL DEFAULT '',payment_instructions TEXT NOT NULL DEFAULT '',due_on TEXT,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED')),number TEXT,issued_on TEXT,version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,sales_order_id,generation),UNIQUE(organization_id,supersedes_invoice_id),UNIQUE(organization_id,number),FOREIGN KEY(organization_id,sales_order_id) REFERENCES ${t('sales_orders')}(organization_id,id),FOREIGN KEY(organization_id,supersedes_invoice_id) REFERENCES ${t('client_invoices')}(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),CHECK((status='DRAFT' AND number IS NULL AND issued_on IS NULL) OR (status='ISSUED' AND number IS NOT NULL AND issued_on IS NOT NULL)));
CREATE TABLE ${t('invoice_items')}(
 organization_id TEXT NOT NULL,invoice_id TEXT NOT NULL,position INTEGER NOT NULL,description TEXT NOT NULL,quantity INTEGER NOT NULL,unit_minor BIGINT NOT NULL,tax_rate_bps INTEGER NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,
 PRIMARY KEY(organization_id,invoice_id,position),FOREIGN KEY(organization_id,invoice_id) REFERENCES ${t('client_invoices')}(organization_id,id));
CREATE TABLE ${t('payment_records')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,invoice_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('PAYMENT','REVERSAL')),reverses_id TEXT,request_id TEXT,request_hash TEXT,amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=9007199254740991),currency TEXT NOT NULL,paid_on TEXT NOT NULL,reference TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,invoice_id),UNIQUE(organization_id,invoice_id,request_id),UNIQUE(organization_id,reverses_id),FOREIGN KEY(organization_id,invoice_id) REFERENCES ${t('client_invoices')}(organization_id,id),FOREIGN KEY(organization_id,reverses_id,invoice_id) REFERENCES ${t('payment_records')}(organization_id,id,invoice_id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id),CHECK((kind='PAYMENT' AND reverses_id IS NULL AND request_id IS NOT NULL AND request_hash IS NOT NULL) OR (kind='REVERSAL' AND reverses_id IS NOT NULL AND request_id IS NULL AND request_hash IS NULL)));
CREATE UNIQUE INDEX platform_payment_reference ON ${t('payment_records')}(organization_id,invoice_id,reference) WHERE kind='PAYMENT';
CREATE TABLE ${t('credit_notes')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,invoice_id TEXT NOT NULL,number TEXT NOT NULL,reason TEXT NOT NULL,currency TEXT NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,issued_on TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,invoice_id),UNIQUE(organization_id,number),FOREIGN KEY(organization_id,invoice_id) REFERENCES ${t('client_invoices')}(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE INDEX platform_invoice_list ON ${t('client_invoices')}(organization_id,status,created_at,id);
`;
}
const identity=['organization_id','id','sales_order_id','generation','supersedes_invoice_id','created_by','customer_id','title','currency','terms','customer_name','customer_email','subtotal_minor','tax_minor','total_minor','created_at'];
const issued=['issuer_name','issuer_address','customer_address','payment_instructions','due_on','number','issued_on'];
const state="(OLD.status='DRAFT' AND NEW.status IN ('DRAFT','ISSUED')) OR (OLD.status='ISSUED' AND NEW.status='ISSUED')";
const history=['invoice_items','payment_records','credit_notes'];
export function invoiceSqliteGuards(){return `
CREATE TRIGGER platform_invoice_guard BEFORE UPDATE ON platform_client_invoices WHEN NOT (${state}) OR NEW.version<>OLD.version+1 OR (${identity.map(key=>`NEW.${key} IS NOT OLD.${key}`).join(' OR ')}) OR (OLD.status='ISSUED' AND (${issued.map(key=>`NEW.${key} IS NOT OLD.${key}`).join(' OR ')})) BEGIN SELECT RAISE(ABORT,'Invoice snapshot, issued terms or version is immutable'); END;
CREATE TRIGGER platform_invoice_items_insert BEFORE INSERT ON platform_invoice_items WHEN (SELECT status FROM platform_client_invoices WHERE organization_id=NEW.organization_id AND id=NEW.invoice_id)<>'DRAFT' BEGIN SELECT RAISE(ABORT,'Issued invoice items are immutable'); END;
${history.flatMap(name=>['UPDATE','DELETE'].map(op=>`CREATE TRIGGER platform_${name}_${op.toLowerCase()} BEFORE ${op} ON platform_${name} BEGIN SELECT RAISE(ABORT,'Invoice history is immutable'); END;`)).join('\n')}
`;}
export function invoicePostgresGuards(){return `
CREATE FUNCTION novaworks.guard_client_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NOT (${state}) OR NEW.version<>OLD.version+1 OR (${identity.map(key=>`NEW.${key} IS DISTINCT FROM OLD.${key}`).join(' OR ')}) OR (OLD.status='ISSUED' AND (${issued.map(key=>`NEW.${key} IS DISTINCT FROM OLD.${key}`).join(' OR ')})) THEN RAISE EXCEPTION 'Invoice snapshot, issued terms or version is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_invoice_guard BEFORE UPDATE ON novaworks.platform_client_invoices FOR EACH ROW EXECUTE FUNCTION novaworks.guard_client_invoice();
CREATE FUNCTION novaworks.guard_invoice_item_insert() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF EXISTS(SELECT 1 FROM novaworks.platform_client_invoices WHERE organization_id=NEW.organization_id AND id=NEW.invoice_id AND status<>'DRAFT') THEN RAISE EXCEPTION 'Issued invoice items are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_invoice_items_insert BEFORE INSERT ON novaworks.platform_invoice_items FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_item_insert();
CREATE FUNCTION novaworks.guard_invoice_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Invoice history is immutable'; END $$;
${history.map(name=>`CREATE TRIGGER platform_${name}_guard BEFORE UPDATE OR DELETE ON novaworks.platform_${name} FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_history();`).join('\n')}
REVOKE ALL ON FUNCTION novaworks.guard_client_invoice(),novaworks.guard_invoice_item_insert(),novaworks.guard_invoice_history() FROM PUBLIC;
`;}
export function invoiceRlsSql(){return invoiceTables.map(name=>{
 const table=`novaworks.platform_${name}`,scope="organization_id=NULLIF(current_setting('app.organization_id',true),'')";
 return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
${['client_invoices','invoice_counters'].includes(name)?`CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});`:''}
REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');}
