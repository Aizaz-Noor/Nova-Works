// Membership rows are historical identities: lifecycle transitions never delete them.
export function memberLifecycleSql(prefix='') {
 const t=name=>`${prefix}platform_${name}`;
 return `ALTER TABLE ${t('memberships')} ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED'));
ALTER TABLE ${t('memberships')} ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE ${t('memberships')} ADD COLUMN updated_at TEXT;
UPDATE ${t('memberships')} SET updated_at=created_at;
CREATE TABLE ${t('member_access')}(organization_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED')),PRIMARY KEY(organization_id,user_id),FOREIGN KEY(organization_id,user_id) REFERENCES ${t('memberships')}(organization_id,user_id));
INSERT INTO ${t('member_access')}(organization_id,user_id,status) SELECT organization_id,user_id,status FROM ${t('memberships')};`;
}

export function memberLifecyclePostgresSql() {
 const identity="NULLIF(current_setting('app.user_id',true),'')",company="NULLIF(current_setting('app.organization_id',true),'')";
 const active=`EXISTS(SELECT 1 FROM novaworks.platform_member_access a WHERE a.organization_id=${company} AND a.user_id=${identity} AND a.status='ACTIVE')`;
 return memberLifecycleSql('novaworks.')+`
-- The migration account may be privileged; these functions must not inherit it.
DO $guard_role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='novaworks_member_lifecycle_guard') THEN
  CREATE ROLE novaworks_member_lifecycle_guard NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='novaworks_member_lifecycle_guard' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)) OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='novaworks_member_lifecycle_guard')) THEN
  RAISE EXCEPTION 'Unsafe member lifecycle guard role';
 END IF;
END $guard_role$;
GRANT USAGE ON SCHEMA novaworks TO novaworks_member_lifecycle_guard;
GRANT SELECT ON novaworks.platform_memberships TO novaworks_member_lifecycle_guard;
GRANT UPDATE(role,status,version,updated_at) ON novaworks.platform_memberships TO novaworks_member_lifecycle_guard;
GRANT INSERT ON novaworks.platform_audit TO novaworks_member_lifecycle_guard;
ALTER TABLE novaworks.platform_member_access OWNER TO novaworks_member_lifecycle_guard;
ALTER TABLE novaworks.platform_member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_member_access FORCE ROW LEVEL SECURITY;
REVOKE ALL ON novaworks.platform_member_access FROM PUBLIC;
CREATE POLICY own_gate_read ON novaworks.platform_member_access FOR SELECT USING(user_id=${identity} OR (pg_trigger_depth()>0 AND organization_id=${company}));
CREATE POLICY gate_trigger_insert ON novaworks.platform_member_access FOR INSERT WITH CHECK(pg_trigger_depth()>0 AND organization_id=${company});
CREATE POLICY gate_trigger_update ON novaworks.platform_member_access FOR UPDATE USING(pg_trigger_depth()>0 AND organization_id=${company}) WITH CHECK(pg_trigger_depth()>0 AND organization_id=${company});
CREATE FUNCTION novaworks.sync_member_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,novaworks AS $sync$
BEGIN
 INSERT INTO novaworks.platform_member_access(organization_id,user_id,status) VALUES(NEW.organization_id,NEW.user_id,NEW.status)
 ON CONFLICT(organization_id,user_id) DO UPDATE SET status=EXCLUDED.status;
 RETURN NEW;
END $sync$;
ALTER FUNCTION novaworks.sync_member_gate() OWNER TO novaworks_member_lifecycle_guard;
REVOKE ALL ON FUNCTION novaworks.sync_member_gate() FROM PUBLIC;
CREATE TRIGGER sync_member_gate AFTER INSERT OR UPDATE OF status ON novaworks.platform_memberships FOR EACH ROW EXECUTE FUNCTION novaworks.sync_member_gate();
DO $policies$
DECLARE item RECORD; expression TEXT; checked TEXT;
BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='novaworks' AND tablename LIKE 'platform_%' AND tablename NOT IN ('platform_migrations','platform_member_access') ORDER BY tablename LOOP
  expression := ${sqlLiteral(active)}; checked := expression;
  IF item.tablename='platform_memberships' THEN expression := ${sqlLiteral(`user_id=${identity} OR ${active}`)}; checked := expression;
  ELSIF item.tablename='platform_organizations' THEN expression := ${sqlLiteral(`created_by=${identity} OR EXISTS(SELECT 1 FROM novaworks.platform_member_access a WHERE a.organization_id=platform_organizations.id AND a.user_id=${identity} AND a.status='ACTIVE')`)}; checked := expression;
  ELSIF item.tablename='platform_invitations' THEN
   expression := ${sqlLiteral(`${active} OR (token_hash=NULLIF(current_setting('app.invitation_hash',true),'') AND email=(SELECT email FROM novaworks.users WHERE id=${identity}) AND accepted_at IS NULL)`)};
   checked := ${sqlLiteral(`${active} OR (token_hash=NULLIF(current_setting('app.invitation_hash',true),'') AND email=(SELECT email FROM novaworks.users WHERE id=${identity}))`)};
  END IF;
  EXECUTE format('CREATE POLICY member_access_gate ON novaworks.%I AS RESTRICTIVE FOR ALL USING(%s) WITH CHECK(%s)',item.tablename,expression,checked);
 END LOOP;
END $policies$;
CREATE FUNCTION novaworks.transition_company_member(target_user TEXT,expected_version INTEGER,next_role TEXT,next_status TEXT,audit_id TEXT,changed_at TEXT)
RETURNS SETOF novaworks.platform_memberships LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,novaworks AS $transition$
DECLARE actor TEXT := ${identity}; company TEXT := ${company}; actor_row novaworks.platform_memberships%ROWTYPE; target_row novaworks.platform_memberships%ROWTYPE;
BEGIN
 IF actor IS NULL OR company IS NULL OR target_user IS NULL OR target_user=actor THEN RAISE EXCEPTION 'MEMBER_FORBIDDEN'; END IF;
 IF next_role IS NULL OR next_role NOT IN ('ADMIN','MANAGER','MEMBER') OR next_status IS NULL OR next_status NOT IN ('ACTIVE','SUSPENDED') OR expected_version IS NULL OR expected_version<1 OR audit_id IS NULL OR audit_id='' OR changed_at IS NULL OR changed_at='' THEN RAISE EXCEPTION 'MEMBER_INVALID_TRANSITION'; END IF;
 -- Caller holds its shared actor lock. Direct function callers receive the same fence.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('member:'||company||':'||actor,0));
 SELECT * INTO actor_row FROM novaworks.platform_memberships WHERE organization_id=company AND user_id=actor;
 IF NOT FOUND OR actor_row.status<>'ACTIVE' OR actor_row.role NOT IN ('OWNER','ADMIN') THEN RAISE EXCEPTION 'MEMBER_FORBIDDEN'; END IF;
 -- Refuse forbidden targets before waiting; two administrators cannot lock each other.
 SELECT * INTO target_row FROM novaworks.platform_memberships WHERE organization_id=company AND user_id=target_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
 IF target_row.role='OWNER' OR (actor_row.role='ADMIN' AND (target_row.role='ADMIN' OR next_role='ADMIN')) THEN RAISE EXCEPTION 'MEMBER_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('member:'||company||':'||target_user,0));
 SELECT * INTO target_row FROM novaworks.platform_memberships WHERE organization_id=company AND user_id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
 IF target_row.role='OWNER' OR (actor_row.role='ADMIN' AND target_row.role='ADMIN') THEN RAISE EXCEPTION 'MEMBER_FORBIDDEN'; END IF;
 IF target_row.version<>expected_version THEN RAISE EXCEPTION 'MEMBER_VERSION_CONFLICT'; END IF;
 IF target_row.role=next_role AND target_row.status=next_status THEN RETURN NEXT target_row; RETURN; END IF;
 UPDATE novaworks.platform_memberships SET role=next_role,status=next_status,version=version+1,updated_at=changed_at WHERE organization_id=company AND user_id=target_user RETURNING * INTO target_row;
 INSERT INTO novaworks.platform_audit(organization_id,id,actor_id,action,entity_id,created_at) VALUES(company,audit_id,actor,'MEMBER_TRANSITION:'||next_role||':'||next_status,target_user,changed_at);
 RETURN NEXT target_row;
END $transition$;
ALTER FUNCTION novaworks.transition_company_member(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT) OWNER TO novaworks_member_lifecycle_guard;
REVOKE ALL ON FUNCTION novaworks.transition_company_member(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
`;
}

function sqlLiteral(value){return `'${value.replaceAll("'","''")}'`;}

export function memberLifecycleSqliteGuards(){return `
CREATE TRIGGER member_gate_insert AFTER INSERT ON platform_memberships BEGIN
 INSERT INTO platform_member_access(organization_id,user_id,status) VALUES(NEW.organization_id,NEW.user_id,NEW.status);
END;
CREATE TRIGGER member_gate_update AFTER UPDATE OF status ON platform_memberships BEGIN
 UPDATE platform_member_access SET status=NEW.status WHERE organization_id=NEW.organization_id AND user_id=NEW.user_id;
END;`;}
