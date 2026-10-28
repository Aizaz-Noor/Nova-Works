-- Authorized operator step AFTER --no-owner restore, BEFORE runtime startup.
-- Same-cluster recovery assumes migration024's guard role already exists.
-- Cross-cluster role creation/credential/key restoration is a separate procedure.
BEGIN;
DO $validated_owner$
DECLARE candidate RECORD;
BEGIN
 SELECT * INTO candidate FROM pg_roles WHERE rolname='novaworks_member_lifecycle_guard';
 IF NOT FOUND OR candidate.rolcanlogin OR candidate.rolsuper OR candidate.rolcreatedb OR candidate.rolcreaterole OR candidate.rolinherit OR candidate.rolreplication OR candidate.rolbypassrls THEN
  RAISE EXCEPTION 'Missing or unsafe member lifecycle guard role';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=candidate.oid) THEN
  RAISE EXCEPTION 'Member lifecycle guard must inherit no roles';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='novaworks.platform_member_access'::regclass AND relrowsecurity AND relforcerowsecurity) THEN
  RAISE EXCEPTION 'Restored member access ledger requires forced RLS';
 END IF;
END $validated_owner$;
ALTER TABLE novaworks.platform_member_access OWNER TO novaworks_member_lifecycle_guard;
ALTER FUNCTION novaworks.sync_member_gate() OWNER TO novaworks_member_lifecycle_guard;
ALTER FUNCTION novaworks.transition_company_member(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT) OWNER TO novaworks_member_lifecycle_guard;
-- --no-acl also strips the guard's explicit privileges on other tenant tables.
GRANT USAGE ON SCHEMA novaworks TO novaworks_member_lifecycle_guard;
GRANT SELECT ON novaworks.platform_memberships TO novaworks_member_lifecycle_guard;
GRANT UPDATE(role,status,version,updated_at) ON novaworks.platform_memberships TO novaworks_member_lifecycle_guard;
GRANT INSERT ON novaworks.platform_audit TO novaworks_member_lifecycle_guard;
REVOKE ALL ON novaworks.platform_member_access FROM PUBLIC;
REVOKE ALL ON FUNCTION novaworks.sync_member_gate() FROM PUBLIC;
REVOKE ALL ON FUNCTION novaworks.transition_company_member(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
COMMIT;
