-- Dedicated operator role; never reuse the application credential.
-- psql -v retention_role=novaworks_recovery_operator -f this-file.sql
\set ON_ERROR_STOP on
SELECT set_config('novaworks.retention_role', :'retention_role', false);
DO $body$
DECLARE role_name TEXT:=current_setting('novaworks.retention_role'); attrs RECORD; role_oid OID;
BEGIN
 IF role_name!~'^[a-z][a-z0-9_]{2,39}$' THEN RAISE EXCEPTION 'Explicit safe role name required'; END IF;
 SELECT oid INTO role_oid FROM pg_roles WHERE rolname=role_name;
 IF role_oid IS NULL THEN EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',role_name); SELECT oid INTO role_oid FROM pg_roles WHERE rolname=role_name; END IF;
 SELECT * INTO attrs FROM pg_roles WHERE oid=role_oid;
 IF attrs.rolsuper OR attrs.rolcreatedb OR attrs.rolcreaterole OR attrs.rolreplication OR attrs.rolbypassrls OR attrs.rolinherit OR NOT attrs.rolcanlogin OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_oid) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=role_oid) THEN RAISE EXCEPTION 'Operator must have no elevated rights, memberships or ownership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=role_oid) OR EXISTS(SELECT 1 FROM pg_database WHERE datdba=role_oid) OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=role_oid) OR has_schema_privilege(role_name,'novaworks','CREATE') OR has_database_privilege(role_name,current_database(),'CREATE') OR has_table_privilege(role_name,'novaworks.account_recovery_tokens','INSERT') OR has_any_column_privilege(role_name,'novaworks.account_recovery_tokens','UPDATE') THEN RAISE EXCEPTION 'Operator must not own objects, create permanent objects or rewrite tokens'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' AND c.relkind='r' AND c.relname<>'account_recovery_tokens' AND (has_table_privilege(role_name,c.oid,'SELECT') OR has_table_privilege(role_name,c.oid,'INSERT') OR has_table_privilege(role_name,c.oid,'UPDATE') OR has_table_privilege(role_name,c.oid,'DELETE'))) THEN RAISE EXCEPTION 'Use a separate role without business-table privileges'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='novaworks.account_recovery_tokens'::regclass AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'Forced recovery RLS required'; END IF;
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),role_name);
 EXECUTE format('GRANT USAGE ON SCHEMA novaworks TO %I',role_name);
 EXECUTE format('GRANT SELECT,DELETE ON novaworks.account_recovery_tokens TO %I',role_name);
 EXECUTE format('DROP POLICY IF EXISTS %I ON novaworks.account_recovery_tokens','retention_select_'||role_name);
 EXECUTE format('DROP POLICY IF EXISTS %I ON novaworks.account_recovery_tokens','retention_delete_'||role_name);
 EXECUTE format('CREATE POLICY %I ON novaworks.account_recovery_tokens FOR SELECT TO %I USING (expires_at::timestamptz <= CURRENT_TIMESTAMP - INTERVAL ''7 days'' AND expires_at<=NULLIF(current_setting(''app.recovery_retention_cutoff'',true),''''))','retention_select_'||role_name,role_name);
 EXECUTE format('CREATE POLICY %I ON novaworks.account_recovery_tokens FOR DELETE TO %I USING (expires_at::timestamptz <= CURRENT_TIMESTAMP - INTERVAL ''7 days'' AND expires_at<=NULLIF(current_setting(''app.recovery_retention_cutoff'',true),''''))','retention_delete_'||role_name,role_name);
END $body$;
