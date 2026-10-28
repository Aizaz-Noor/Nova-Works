-- Review reference. Apply through db:migrate:erp to record version/checksum.

CREATE TABLE novaworks.platform_quotes(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,deal_id TEXT,owner_id TEXT NOT NULL,title TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN ('USD','GBP','PKR')),terms TEXT NOT NULL DEFAULT '',valid_until TEXT,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','ACCEPTED','DECLINED','SUPERSEDED')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),supersedes_quote_id TEXT,
 customer_name TEXT NOT NULL,customer_email TEXT NOT NULL DEFAULT '',subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL CHECK(total_minor>=0 AND total_minor<=9007199254740991),
 issued_at TEXT,accepted_at TEXT,accepted_by TEXT,approval_reference TEXT NOT NULL DEFAULT '',decline_reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,supersedes_quote_id),FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),FOREIGN KEY(organization_id,deal_id) REFERENCES novaworks.platform_deals(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,accepted_by) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,supersedes_quote_id) REFERENCES novaworks.platform_quotes(organization_id,id));
CREATE TABLE novaworks.platform_quote_items(
 organization_id TEXT NOT NULL,quote_id TEXT NOT NULL,position INTEGER NOT NULL,description TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0 AND quantity<=1000000),unit_minor BIGINT NOT NULL CHECK(unit_minor>=0),tax_rate_bps INTEGER NOT NULL CHECK(tax_rate_bps>=0 AND tax_rate_bps<=10000),subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,
 PRIMARY KEY(organization_id,quote_id,position),FOREIGN KEY(organization_id,quote_id) REFERENCES novaworks.platform_quotes(organization_id,id));
CREATE TABLE novaworks.platform_sales_orders(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,quote_id TEXT NOT NULL,quote_version INTEGER NOT NULL,customer_id TEXT NOT NULL,deal_id TEXT,owner_id TEXT NOT NULL,title TEXT NOT NULL,currency TEXT NOT NULL,terms TEXT NOT NULL,valid_until TEXT,customer_name TEXT NOT NULL,customer_email TEXT NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,accepted_at TEXT NOT NULL,accepted_by TEXT NOT NULL,approval_reference TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,quote_id),FOREIGN KEY(organization_id,quote_id) REFERENCES novaworks.platform_quotes(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES novaworks.platform_customers(organization_id,id),FOREIGN KEY(organization_id,deal_id) REFERENCES novaworks.platform_deals(organization_id,id),FOREIGN KEY(organization_id,owner_id) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,accepted_by) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE TABLE novaworks.platform_sales_order_items(
 organization_id TEXT NOT NULL,order_id TEXT NOT NULL,position INTEGER NOT NULL,description TEXT NOT NULL,quantity INTEGER NOT NULL,unit_minor BIGINT NOT NULL,tax_rate_bps INTEGER NOT NULL,subtotal_minor BIGINT NOT NULL,tax_minor BIGINT NOT NULL,total_minor BIGINT NOT NULL,
 PRIMARY KEY(organization_id,order_id,position),FOREIGN KEY(organization_id,order_id) REFERENCES novaworks.platform_sales_orders(organization_id,id));
CREATE INDEX platform_quotes_list ON novaworks.platform_quotes(organization_id,status,created_at,id);
CREATE INDEX platform_sales_orders_list ON novaworks.platform_sales_orders(organization_id,created_at,id);

CREATE FUNCTION novaworks.guard_quote_terms() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NOT ((OLD.status='DRAFT' AND NEW.status IN ('DRAFT','ISSUED')) OR (OLD.status='ISSUED' AND NEW.status IN ('ACCEPTED','DECLINED','SUPERSEDED')) OR (OLD.status='DECLINED' AND NEW.status='SUPERSEDED')) THEN RAISE EXCEPTION 'Invalid quote transition'; END IF; IF OLD.status<>'DRAFT' AND (OLD.customer_id IS DISTINCT FROM NEW.customer_id OR OLD.deal_id IS DISTINCT FROM NEW.deal_id OR OLD.owner_id IS DISTINCT FROM NEW.owner_id OR OLD.title IS DISTINCT FROM NEW.title OR OLD.currency IS DISTINCT FROM NEW.currency OR OLD.terms IS DISTINCT FROM NEW.terms OR OLD.valid_until IS DISTINCT FROM NEW.valid_until OR OLD.customer_name IS DISTINCT FROM NEW.customer_name OR OLD.customer_email IS DISTINCT FROM NEW.customer_email OR OLD.subtotal_minor IS DISTINCT FROM NEW.subtotal_minor OR OLD.tax_minor IS DISTINCT FROM NEW.tax_minor OR OLD.total_minor IS DISTINCT FROM NEW.total_minor OR OLD.supersedes_quote_id IS DISTINCT FROM NEW.supersedes_quote_id OR OLD.issued_at IS DISTINCT FROM NEW.issued_at) THEN RAISE EXCEPTION 'Issued quote terms are immutable'; END IF; RETURN NEW; END $$;
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
ALTER TABLE novaworks.platform_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_quotes FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_quotes FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_quotes FOR UPDATE USING (organization_id=NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_quotes FROM PUBLIC;
ALTER TABLE novaworks.platform_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_quote_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_quote_items FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_quote_items FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_quote_items FOR UPDATE USING (organization_id=NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_delete ON novaworks.platform_quote_items FOR DELETE USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_quote_items FROM PUBLIC;
ALTER TABLE novaworks.platform_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_sales_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_sales_orders FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_sales_orders FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));


REVOKE ALL ON novaworks.platform_sales_orders FROM PUBLIC;
ALTER TABLE novaworks.platform_sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_sales_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_sales_order_items FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_sales_order_items FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));


REVOKE ALL ON novaworks.platform_sales_order_items FROM PUBLIC;