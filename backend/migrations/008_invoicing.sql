-- Review reference. Apply through db:migrate:erp to record version/checksum.

CREATE TABLE novaworks.platform_invoice_counters(organization_id TEXT NOT NULL REFERENCES novaworks.platform_organizations(id),kind TEXT NOT NULL CHECK(kind IN ('INVOICE','CREDIT')),next_value INTEGER NOT NULL CHECK(next_value>=1 AND next_value<=1000000000),PRIMARY KEY(organization_id,kind));
CREATE TABLE novaworks.platform_client_invoices(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,sales_order_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>=1),supersedes_invoice_id TEXT,created_by TEXT NOT NULL,customer_id TEXT NOT NULL,title TEXT NOT NULL,currency TEXT NOT NULL,terms TEXT NOT NULL,customer_name TEXT NOT NULL,customer_email TEXT NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL CHECK(total_minor>=0 AND total_minor<=9007199254740991),
 issuer_name TEXT NOT NULL,issuer_address TEXT NOT NULL DEFAULT '',customer_address TEXT NOT NULL DEFAULT '',payment_instructions TEXT NOT NULL DEFAULT '',due_on TEXT,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED')),number TEXT,issued_on TEXT,version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,sales_order_id,generation),UNIQUE(organization_id,supersedes_invoice_id),UNIQUE(organization_id,number),FOREIGN KEY(organization_id,sales_order_id) REFERENCES novaworks.platform_sales_orders(organization_id,id),FOREIGN KEY(organization_id,supersedes_invoice_id) REFERENCES novaworks.platform_client_invoices(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),CHECK((status='DRAFT' AND number IS NULL AND issued_on IS NULL) OR (status='ISSUED' AND number IS NOT NULL AND issued_on IS NOT NULL)));
CREATE TABLE novaworks.platform_invoice_items(
 organization_id TEXT NOT NULL,invoice_id TEXT NOT NULL,position INTEGER NOT NULL,description TEXT NOT NULL,quantity INTEGER NOT NULL,unit_minor BIGINT NOT NULL,tax_rate_bps INTEGER NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,
 PRIMARY KEY(organization_id,invoice_id,position),FOREIGN KEY(organization_id,invoice_id) REFERENCES novaworks.platform_client_invoices(organization_id,id));
CREATE TABLE novaworks.platform_payment_records(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,invoice_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('PAYMENT','REVERSAL')),reverses_id TEXT,request_id TEXT,request_hash TEXT,amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=9007199254740991),currency TEXT NOT NULL,paid_on TEXT NOT NULL,reference TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,invoice_id),UNIQUE(organization_id,invoice_id,request_id),UNIQUE(organization_id,reverses_id),FOREIGN KEY(organization_id,invoice_id) REFERENCES novaworks.platform_client_invoices(organization_id,id),FOREIGN KEY(organization_id,reverses_id,invoice_id) REFERENCES novaworks.platform_payment_records(organization_id,id,invoice_id),FOREIGN KEY(organization_id,created_by) REFERENCES novaworks.platform_memberships(organization_id,user_id),CHECK((kind='PAYMENT' AND reverses_id IS NULL AND request_id IS NOT NULL AND request_hash IS NOT NULL) OR (kind='REVERSAL' AND reverses_id IS NOT NULL AND request_id IS NULL AND request_hash IS NULL)));
CREATE UNIQUE INDEX platform_payment_reference ON novaworks.platform_payment_records(organization_id,invoice_id,reference) WHERE kind='PAYMENT';
CREATE TABLE novaworks.platform_credit_notes(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,invoice_id TEXT NOT NULL,number TEXT NOT NULL,reason TEXT NOT NULL,currency TEXT NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,issued_on TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,invoice_id),UNIQUE(organization_id,number),FOREIGN KEY(organization_id,invoice_id) REFERENCES novaworks.platform_client_invoices(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE INDEX platform_invoice_list ON novaworks.platform_client_invoices(organization_id,status,created_at,id);

CREATE FUNCTION novaworks.guard_client_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NOT ((OLD.status='DRAFT' AND NEW.status IN ('DRAFT','ISSUED')) OR (OLD.status='ISSUED' AND NEW.status='ISSUED')) OR NEW.version<>OLD.version+1 OR (NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.sales_order_id IS DISTINCT FROM OLD.sales_order_id OR NEW.generation IS DISTINCT FROM OLD.generation OR NEW.supersedes_invoice_id IS DISTINCT FROM OLD.supersedes_invoice_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.title IS DISTINCT FROM OLD.title OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.terms IS DISTINCT FROM OLD.terms OR NEW.customer_name IS DISTINCT FROM OLD.customer_name OR NEW.customer_email IS DISTINCT FROM OLD.customer_email OR NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor OR NEW.total_minor IS DISTINCT FROM OLD.total_minor OR NEW.created_at IS DISTINCT FROM OLD.created_at) OR (OLD.status='ISSUED' AND (NEW.issuer_name IS DISTINCT FROM OLD.issuer_name OR NEW.issuer_address IS DISTINCT FROM OLD.issuer_address OR NEW.customer_address IS DISTINCT FROM OLD.customer_address OR NEW.payment_instructions IS DISTINCT FROM OLD.payment_instructions OR NEW.due_on IS DISTINCT FROM OLD.due_on OR NEW.number IS DISTINCT FROM OLD.number OR NEW.issued_on IS DISTINCT FROM OLD.issued_on)) THEN RAISE EXCEPTION 'Invoice snapshot, issued terms or version is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_invoice_guard BEFORE UPDATE ON novaworks.platform_client_invoices FOR EACH ROW EXECUTE FUNCTION novaworks.guard_client_invoice();
CREATE FUNCTION novaworks.guard_invoice_item_insert() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF EXISTS(SELECT 1 FROM novaworks.platform_client_invoices WHERE organization_id=NEW.organization_id AND id=NEW.invoice_id AND status<>'DRAFT') THEN RAISE EXCEPTION 'Issued invoice items are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_invoice_items_insert BEFORE INSERT ON novaworks.platform_invoice_items FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_item_insert();
CREATE FUNCTION novaworks.guard_invoice_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Invoice history is immutable'; END $$;
CREATE TRIGGER platform_invoice_items_guard BEFORE UPDATE OR DELETE ON novaworks.platform_invoice_items FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_history();
CREATE TRIGGER platform_payment_records_guard BEFORE UPDATE OR DELETE ON novaworks.platform_payment_records FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_history();
CREATE TRIGGER platform_credit_notes_guard BEFORE UPDATE OR DELETE ON novaworks.platform_credit_notes FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_history();
REVOKE ALL ON FUNCTION novaworks.guard_client_invoice(),novaworks.guard_invoice_item_insert(),novaworks.guard_invoice_history() FROM PUBLIC;
ALTER TABLE novaworks.platform_client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_client_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_client_invoices FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_client_invoices FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_client_invoices FOR UPDATE USING (organization_id=NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_client_invoices FROM PUBLIC;
ALTER TABLE novaworks.platform_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_invoice_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_invoice_items FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_invoice_items FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_invoice_items FROM PUBLIC;
ALTER TABLE novaworks.platform_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_payment_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_payment_records FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_payment_records FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_payment_records FROM PUBLIC;
ALTER TABLE novaworks.platform_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_credit_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_credit_notes FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_credit_notes FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_credit_notes FROM PUBLIC;
ALTER TABLE novaworks.platform_invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_invoice_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_invoice_counters FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_invoice_counters FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_invoice_counters FOR UPDATE USING (organization_id=NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_invoice_counters FROM PUBLIC;