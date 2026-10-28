\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
\echo 'Required: -v runtime_role=novaworks_runtime'
\quit 1
\endif
BEGIN;
SELECT set_config('novaworks.provision_role', :'runtime_role', true);
DO $provision$
DECLARE
 role_name text := current_setting('novaworks.provision_role');
 runtime_id oid;
 attrs record;
 item record;
 command text;
 policy_name text;
BEGIN
 IF role_name !~ '^[a-z][a-z0-9_]{2,39}$' THEN RAISE EXCEPTION 'Invalid dedicated runtime role name'; END IF;
 SELECT oid INTO runtime_id FROM pg_roles WHERE rolname=role_name;
 IF runtime_id IS NULL THEN
  EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',role_name);
  SELECT oid INTO runtime_id FROM pg_roles WHERE rolname=role_name;
 END IF;
 SELECT * INTO attrs FROM pg_roles WHERE oid=runtime_id;
 IF attrs.rolsuper OR attrs.rolcreatedb OR attrs.rolcreaterole OR attrs.rolreplication OR attrs.rolbypassrls OR attrs.rolinherit OR NOT attrs.rolcanlogin THEN RAISE EXCEPTION 'Unsafe runtime role attributes'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=runtime_id) THEN RAISE EXCEPTION 'Runtime role must have no role memberships'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=runtime_id) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=runtime_id) OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=runtime_id) OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=runtime_id) THEN RAISE EXCEPTION 'Runtime role must own no database objects'; END IF;
 EXECUTE format('REVOKE ALL ON SCHEMA novaworks FROM %I',role_name);
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA novaworks FROM %I',role_name);
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA novaworks FROM %I',role_name);
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),role_name);
 EXECUTE format('GRANT USAGE ON SCHEMA novaworks TO %I',role_name);
 -- Global identity, demo work and server state have API-level business authorization.
 -- Explicit role-targeted policies are essential: legacy RLS had no policies.
 FOR item IN SELECT * FROM (VALUES
  ('users','SELECT,INSERT'),
  ('projects','SELECT,INSERT'),
  ('tasks','SELECT,INSERT'),
  ('transcript_submissions','SELECT,INSERT'),
  ('sessions','SELECT,INSERT,UPDATE,DELETE'),
  ('request_limits','SELECT,INSERT,UPDATE,DELETE'),
  ('ai_drafts','SELECT,INSERT,UPDATE')
 ) AS operations(table_name,privileges)
 LOOP
  EXECUTE format('ALTER TABLE novaworks.%I ENABLE ROW LEVEL SECURITY',item.table_name);
  EXECUTE format('GRANT %s ON TABLE novaworks.%I TO %I',item.privileges,item.table_name,role_name);
  FOREACH command IN ARRAY string_to_array(item.privileges,',') LOOP
   policy_name := 'runtime_' || lower(command) || '_' || role_name;
   EXECUTE format('DROP POLICY IF EXISTS %I ON novaworks.%I',policy_name,item.table_name);
   IF command='INSERT' THEN
    EXECUTE format('CREATE POLICY %I ON novaworks.%I FOR INSERT TO %I WITH CHECK (true)',policy_name,item.table_name,role_name);
   ELSIF command='UPDATE' THEN
    EXECUTE format('CREATE POLICY %I ON novaworks.%I FOR UPDATE TO %I USING (true) WITH CHECK (true)',policy_name,item.table_name,role_name);
   ELSE
    EXECUTE format('CREATE POLICY %I ON novaworks.%I FOR %s TO %I USING (true)',policy_name,item.table_name,command,role_name);
   END IF;
  END LOOP;
 END LOOP;
 -- Password changes require only the credential column, never global profile/role edits.
 EXECUTE format('GRANT UPDATE(password_hash) ON novaworks.users TO %I',role_name);
 policy_name := 'runtime_password_update_' || role_name;
 EXECUTE format('DROP POLICY IF EXISTS %I ON novaworks.users',policy_name);
 EXECUTE format('CREATE POLICY %I ON novaworks.users FOR UPDATE TO %I USING (true) WITH CHECK (true)',policy_name,role_name);
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='novaworks.account_recovery_tokens'::regclass AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'Recovery ledger requires forced RLS'; END IF;
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON novaworks.account_recovery_tokens TO %I',role_name);
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='novaworks.account_security_events'::regclass AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'Security history requires forced RLS'; END IF;
 EXECUTE format('GRANT SELECT,INSERT ON novaworks.account_security_events TO %I',role_name);
 FOREACH command IN ARRAY ARRAY['account_mfa_factors','account_mfa_recovery_codes'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' AND c.relname=command AND c.relrowsecurity AND c.relforcerowsecurity) THEN RAISE EXCEPTION 'MFA table requires forced RLS'; END IF;
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON novaworks.%I TO %I',command,role_name);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='novaworks.account_mfa_events'::regclass AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'MFA history requires forced RLS'; END IF;
 EXECUTE format('GRANT SELECT,INSERT ON novaworks.account_mfa_events TO %I',role_name);
 -- Keep company policies from migration 002; never add permissive runtime policies here.
 FOREACH command IN ARRAY ARRAY['organizations','memberships','projects','tasks','drafts','files','invitations','audit','customers','contacts','activities','project_customers','pipeline_stages','leads','deals','deal_projects','quotes','quote_items','sales_orders','sales_order_items','time_entries','time_approvals','client_invoices','invoice_items','payment_records','credit_notes','invoice_counters','ai_jobs','ai_usage','subscriptions','billing_events','billing_operations','organization_settings','task_comments','milestones','notifications','task_attachments','attachment_usage','billing_rates','time_billing_roots','time_allocations'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' AND c.relname='platform_'||command AND c.relrowsecurity AND c.relforcerowsecurity) THEN RAISE EXCEPTION 'Tenant table missing forced RLS: %',command; END IF;
  IF command='memberships' THEN
   -- Membership lifecycle uses a separately controlled transition, never generic row mutation.
   EXECUTE format('GRANT SELECT,INSERT ON TABLE novaworks.platform_memberships TO %I',role_name);
  ELSIF command='billing_rates' THEN
   EXECUTE format('GRANT SELECT,INSERT ON TABLE novaworks.platform_billing_rates TO %I',role_name);
   EXECUTE format('GRANT UPDATE(hourly_minor,active,version,updated_at) ON TABLE novaworks.platform_billing_rates TO %I',role_name);
  ELSIF command='attachment_usage' THEN
   EXECUTE format('GRANT SELECT ON TABLE novaworks.platform_attachment_usage TO %I',role_name);
  ELSIF command='notifications' THEN
   EXECUTE format('GRANT SELECT,INSERT ON TABLE novaworks.platform_notifications TO %I',role_name);
   EXECUTE format('GRANT UPDATE(read_at) ON TABLE novaworks.platform_notifications TO %I',role_name);
  ELSIF command IN ('activities','audit','time_approvals','billing_events','task_comments','task_attachments','time_billing_roots','time_allocations') THEN
   -- Business history is append-only for the application credential. Retention or
   -- legal erasure requires the separately controlled operator workflow.
   EXECUTE format('GRANT SELECT,INSERT ON TABLE novaworks.%I TO %I','platform_'||command,role_name);
  ELSE
  IF command IN ('time_entries','client_invoices','invoice_counters','ai_jobs','ai_usage','subscriptions','billing_operations','organization_settings','milestones') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON TABLE novaworks.%I TO %I','platform_'||command,role_name);
  ELSIF command IN ('pipeline_stages','deal_projects','sales_orders','sales_order_items','invoice_items','payment_records','credit_notes') THEN
   EXECUTE format('GRANT SELECT,INSERT ON TABLE novaworks.%I TO %I','platform_'||command,role_name);
  ELSE
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE novaworks.%I TO %I','platform_'||command,role_name);
  END IF;
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='novaworks.platform_member_access'::regclass AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'Member access ledger requires forced RLS'; END IF;
 EXECUTE format('GRANT SELECT ON TABLE novaworks.platform_member_access TO %I',role_name);
 EXECUTE format('GRANT EXECUTE ON FUNCTION novaworks.transition_company_member(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT) TO %I',role_name);
 EXECUTE format('GRANT EXECUTE ON FUNCTION novaworks.guard_client_invoice(),novaworks.guard_invoice_item_insert(),novaworks.guard_invoice_history() TO %I',role_name);
 EXECUTE format('GRANT EXECUTE ON FUNCTION novaworks.guard_time_entry(),novaworks.guard_time_approval() TO %I',role_name);
 EXECUTE format('GRANT EXECUTE ON FUNCTION novaworks.guard_quote_terms(),novaworks.guard_quote_items(),novaworks.guard_sales_order() TO %I',role_name);
 -- Invoker trigger functions read users/projects using this same restricted role.
 EXECUTE format('GRANT EXECUTE ON FUNCTION novaworks.check_project_manager() TO %I',role_name);
 EXECUTE format('GRANT EXECUTE ON FUNCTION novaworks.check_task() TO %I',role_name);
 IF has_schema_privilege(role_name,'novaworks','CREATE') OR has_schema_privilege(role_name,'public','CREATE') OR has_database_privilege(role_name,current_database(),'CREATE') THEN RAISE EXCEPTION 'Runtime inherits permanent DDL permission; harden database/schema PUBLIC grants separately'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' AND c.relkind IN ('r','p') AND has_table_privilege(role_name,c.oid,'TRUNCATE')) THEN RAISE EXCEPTION 'Runtime inherits TRUNCATE privilege'; END IF;
END
$provision$;
COMMIT;
