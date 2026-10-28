import {invoiceSql,invoiceSqliteGuards} from './schema.js';

// Snapshot tables deliberately have no update/delete path: a credit never frees time.
function tables(prefix='') {
 const t=n=>`${prefix}platform_${n}`;
 return `CREATE TABLE ${t('time_billing_roots')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,created_by TEXT NOT NULL,project_id TEXT NOT NULL,customer_id TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN ('USD','GBP','PKR')),rate_id TEXT NOT NULL,rate_version INTEGER NOT NULL CHECK(rate_version>0),hourly_minor BIGINT NOT NULL CHECK(hourly_minor>0 AND hourly_minor<=9007199254740991),created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,request_id),UNIQUE(organization_id,id,project_id,customer_id,rate_id,rate_version,hourly_minor,currency),
 FOREIGN KEY(organization_id,created_by) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,project_id) REFERENCES ${t('projects')}(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,project_id,customer_id) REFERENCES ${t('project_customers')}(organization_id,project_id,customer_id),FOREIGN KEY(organization_id,rate_id) REFERENCES ${t('billing_rates')}(organization_id,id));
 CREATE TABLE ${t('time_allocations')}(
 organization_id TEXT NOT NULL,root_id TEXT NOT NULL,entry_id TEXT NOT NULL,entry_version INTEGER NOT NULL CHECK(entry_version>0),submission_no INTEGER NOT NULL CHECK(submission_no>0),approval_id TEXT NOT NULL,user_id TEXT NOT NULL,project_id TEXT NOT NULL,customer_id TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 1440),rate_id TEXT NOT NULL,rate_version INTEGER NOT NULL CHECK(rate_version>0),hourly_minor BIGINT NOT NULL CHECK(hourly_minor>0 AND hourly_minor<=9007199254740991),currency TEXT NOT NULL CHECK(currency IN ('USD','GBP','PKR')),amount_minor BIGINT NOT NULL CHECK(amount_minor>=0 AND amount_minor<=9007199254740991),position INTEGER NOT NULL CHECK(position>=1),description TEXT NOT NULL,work_date TEXT NOT NULL,
 PRIMARY KEY(organization_id,root_id,position),UNIQUE(organization_id,entry_id),
 FOREIGN KEY(organization_id,root_id) REFERENCES ${t('time_billing_roots')}(organization_id,id),FOREIGN KEY(organization_id,root_id,project_id,customer_id,rate_id,rate_version,hourly_minor,currency) REFERENCES ${t('time_billing_roots')}(organization_id,id,project_id,customer_id,rate_id,rate_version,hourly_minor,currency),FOREIGN KEY(organization_id,entry_id) REFERENCES ${t('time_entries')}(organization_id,id),FOREIGN KEY(organization_id,approval_id) REFERENCES ${t('time_approvals')}(organization_id,id),FOREIGN KEY(organization_id,user_id) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,project_id) REFERENCES ${t('projects')}(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES ${t('customers')}(organization_id,id),FOREIGN KEY(organization_id,rate_id) REFERENCES ${t('billing_rates')}(organization_id,id));`;
}
const identity=['source_kind','billing_root_id'];
const sourceCheck="CHECK((source_kind='ORDER' AND sales_order_id IS NOT NULL AND billing_root_id IS NULL) OR (source_kind='TIME' AND sales_order_id IS NULL AND billing_root_id IS NOT NULL))";
function indexes(prefix='') {return `CREATE UNIQUE INDEX platform_time_invoice_generation ON ${prefix}platform_client_invoices(organization_id,billing_root_id,generation) WHERE source_kind='TIME';`;}

export function timeBillingSql(){
 // Preserve child snapshots in unconstrained temporary copies, empty the graph from
 // leaves to root, then rebuild it. Foreign keys remain enabled throughout. This
 // avoids SQLite's rename-parent FK rewriting and deferred DROP bookkeeping.
 const names=['client_invoices','invoice_items','payment_records','credit_notes'];
 const save=names.map(n=>`CREATE TEMP TABLE nw023_${n} AS SELECT * FROM platform_${n};`).join('\n');
 const dropGuards=`DROP TRIGGER platform_invoice_guard; DROP TRIGGER platform_invoice_items_insert; ${names.slice(1).flatMap(n=>['update','delete'].map(op=>`DROP TRIGGER platform_${n}_${op};`)).join(' ')}`;
 const empty=['invoice_items','credit_notes','payment_records','client_invoices'].map(n=>`DELETE FROM platform_${n};`).join('\n');
 const drop=['invoice_items','credit_notes','payment_records','client_invoices'].map(n=>`DROP TABLE platform_${n};`).join('\n');
 let rebuilt=invoiceSql().slice(invoiceSql().indexOf('CREATE TABLE platform_client_invoices'));
 rebuilt=rebuilt.replace('sales_order_id TEXT NOT NULL','sales_order_id TEXT').replace('generation INTEGER NOT NULL',"source_kind TEXT NOT NULL DEFAULT 'ORDER',billing_root_id TEXT,generation INTEGER NOT NULL").replace('PRIMARY KEY(organization_id,id),UNIQUE(organization_id,sales_order_id,generation)',`${sourceCheck},FOREIGN KEY(organization_id,billing_root_id) REFERENCES platform_time_billing_roots(organization_id,id),PRIMARY KEY(organization_id,id),UNIQUE(organization_id,sales_order_id,generation)`);
 // Historical columns are explicit because source metadata is new.
 const oldColumns=['organization_id','id','sales_order_id','generation','supersedes_invoice_id','created_by','customer_id','title','currency','terms','customer_name','customer_email','subtotal_minor','tax_minor','total_minor','issuer_name','issuer_address','customer_address','payment_instructions','due_on','status','number','issued_on','version','created_at','updated_at'];
 const restore=`INSERT INTO platform_client_invoices(${oldColumns.join(',')}) SELECT ${oldColumns.join(',')} FROM nw023_client_invoices;\n${names.slice(1).map(n=>`INSERT INTO platform_${n} SELECT * FROM nw023_${n};`).join('\n')}\n${names.map(n=>`DROP TABLE nw023_${n};`).join('\n')}`;
 const guards=invoiceSqliteGuards().replace('NEW.organization_id IS NOT OLD.organization_id',`${identity.map(k=>`NEW.${k} IS NOT OLD.${k}`).join(' OR ')} OR NEW.organization_id IS NOT OLD.organization_id`);
 const immutable=['time_billing_roots','time_allocations'].flatMap(n=>['UPDATE','DELETE'].map(op=>`CREATE TRIGGER platform_${n}_${op.toLowerCase()} BEFORE ${op} ON platform_${n} BEGIN SELECT RAISE(ABORT,'Time billing history is immutable'); END;`)).join('\n');
 const integers=[['time_billing_roots',['rate_version','hourly_minor']],['time_allocations',['entry_version','submission_no','minutes','rate_version','hourly_minor','amount_minor','position']]].map(([n,keys])=>`CREATE TRIGGER platform_${n}_insert BEFORE INSERT ON platform_${n} WHEN ${keys.map(k=>`typeof(NEW.${k})<>'integer'`).join(' OR ')} BEGIN SELECT RAISE(ABORT,'Time billing values must be integers'); END;`).join('\n');
 return save+dropGuards+empty+drop+tables()+rebuilt+restore+guards+indexes()+immutable+integers;
}

export function timeBillingPostgresSql(){return tables('novaworks.')+`
 ALTER TABLE novaworks.platform_client_invoices ALTER COLUMN sales_order_id DROP NOT NULL;
 ALTER TABLE novaworks.platform_client_invoices ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'ORDER',ADD COLUMN billing_root_id TEXT,ADD CONSTRAINT platform_invoice_source_check ${sourceCheck},ADD CONSTRAINT platform_invoice_time_root_fk FOREIGN KEY(organization_id,billing_root_id) REFERENCES novaworks.platform_time_billing_roots(organization_id,id);
 ${indexes('novaworks.')}
 CREATE FUNCTION novaworks.guard_invoice_source() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NEW.source_kind IS DISTINCT FROM OLD.source_kind OR NEW.billing_root_id IS DISTINCT FROM OLD.billing_root_id THEN RAISE EXCEPTION 'Invoice source is immutable'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER platform_invoice_source_guard BEFORE UPDATE ON novaworks.platform_client_invoices FOR EACH ROW EXECUTE FUNCTION novaworks.guard_invoice_source();
 CREATE FUNCTION novaworks.guard_time_billing_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Time billing history is immutable'; END $$;
 REVOKE ALL ON FUNCTION novaworks.guard_invoice_source(),novaworks.guard_time_billing_history() FROM PUBLIC;
 `+['time_billing_roots','time_allocations'].map(n=>{const table=`novaworks.platform_${n}`,scope=`organization_id=NULLIF(current_setting('app.organization_id',true),'') AND EXISTS(SELECT 1 FROM novaworks.platform_memberships m WHERE m.organization_id=platform_${n}.organization_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.role IN ('OWNER','ADMIN'))`;return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
 CREATE POLICY time_billing_select ON ${table} FOR SELECT USING (${scope}); CREATE POLICY time_billing_insert ON ${table} FOR INSERT WITH CHECK (${scope}${n==='time_billing_roots'?" AND created_by=NULLIF(current_setting('app.user_id',true),'')":''});
 CREATE TRIGGER platform_${n}_guard BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION novaworks.guard_time_billing_history(); REVOKE ALL ON ${table} FROM PUBLIC;`;}).join('\n');}
