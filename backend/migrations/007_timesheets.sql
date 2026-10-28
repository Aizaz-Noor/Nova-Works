-- Review reference. Apply through db:migrate:erp to record version/checksum.

CREATE UNIQUE INDEX platform_tasks_time_reference ON novaworks.platform_tasks(organization_id,id,project_id);
CREATE TABLE novaworks.platform_time_entries(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,project_id TEXT NOT NULL,task_id TEXT,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,work_date TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes>=1 AND minutes<=1440),billable INTEGER NOT NULL CHECK(billable IN (0,1)),description TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','VOID')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),submission_no INTEGER NOT NULL DEFAULT 0 CHECK(submission_no>=0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,user_id,request_id),FOREIGN KEY(organization_id,user_id) REFERENCES novaworks.platform_memberships(organization_id,user_id),FOREIGN KEY(organization_id,project_id) REFERENCES novaworks.platform_projects(organization_id,id),FOREIGN KEY(organization_id,task_id,project_id) REFERENCES novaworks.platform_tasks(organization_id,id,project_id));
CREATE TABLE novaworks.platform_time_approvals(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,entry_id TEXT NOT NULL,submission_no INTEGER NOT NULL,reviewed_version INTEGER NOT NULL,reviewer_id TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('APPROVE','REJECT')),note TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,entry_id,submission_no),FOREIGN KEY(organization_id,entry_id) REFERENCES novaworks.platform_time_entries(organization_id,id),FOREIGN KEY(organization_id,reviewer_id) REFERENCES novaworks.platform_memberships(organization_id,user_id));
CREATE INDEX platform_time_worker_date ON novaworks.platform_time_entries(organization_id,user_id,work_date);
CREATE INDEX platform_time_project_state ON novaworks.platform_time_entries(organization_id,project_id,status,work_date);

CREATE FUNCTION novaworks.guard_time_entry() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT ((OLD.status IN ('DRAFT','REJECTED') AND NEW.status IN (OLD.status,'SUBMITTED','VOID')) OR (OLD.status='SUBMITTED' AND NEW.status IN ('APPROVED','REJECTED'))) OR NEW.version<>OLD.version+1 OR NEW.submission_no<>OLD.submission_no+(CASE WHEN NEW.status='SUBMITTED' THEN 1 ELSE 0 END) OR (NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.request_hash IS DISTINCT FROM OLD.request_hash OR NEW.created_at IS DISTINCT FROM OLD.created_at) OR (OLD.status='SUBMITTED' AND (NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.task_id IS DISTINCT FROM OLD.task_id OR NEW.work_date IS DISTINCT FROM OLD.work_date OR NEW.minutes IS DISTINCT FROM OLD.minutes OR NEW.billable IS DISTINCT FROM OLD.billable OR NEW.description IS DISTINCT FROM OLD.description)) THEN RAISE EXCEPTION 'Time entry state, version or protected content is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_time_guard BEFORE UPDATE ON novaworks.platform_time_entries FOR EACH ROW EXECUTE FUNCTION novaworks.guard_time_entry();
CREATE FUNCTION novaworks.guard_time_approval() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Time approvals are immutable'; END $$;
CREATE TRIGGER platform_time_approval_guard BEFORE UPDATE OR DELETE ON novaworks.platform_time_approvals FOR EACH ROW EXECUTE FUNCTION novaworks.guard_time_approval();
REVOKE ALL ON FUNCTION novaworks.guard_time_entry(),novaworks.guard_time_approval() FROM PUBLIC;
ALTER TABLE novaworks.platform_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_time_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_time_entries FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_time_entries FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_update ON novaworks.platform_time_entries FOR UPDATE USING (organization_id=NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));
REVOKE ALL ON novaworks.platform_time_entries FROM PUBLIC;
ALTER TABLE novaworks.platform_time_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE novaworks.platform_time_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON novaworks.platform_time_approvals FOR SELECT USING (organization_id=NULLIF(current_setting('app.organization_id',true),''));
CREATE POLICY tenant_insert ON novaworks.platform_time_approvals FOR INSERT WITH CHECK (organization_id=NULLIF(current_setting('app.organization_id',true),''));

REVOKE ALL ON novaworks.platform_time_approvals FROM PUBLIC;