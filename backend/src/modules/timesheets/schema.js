export const timeTables=['time_entries','time_approvals'];
export function timeSql(prefix=''){
 const t=name=>`${prefix}platform_${name}`;
 return `
CREATE UNIQUE INDEX platform_tasks_time_reference ON ${t('tasks')}(organization_id,id,project_id);
CREATE TABLE ${t('time_entries')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,project_id TEXT NOT NULL,task_id TEXT,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,work_date TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes>=1 AND minutes<=1440),billable INTEGER NOT NULL CHECK(billable IN (0,1)),description TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','VOID')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),submission_no INTEGER NOT NULL DEFAULT 0 CHECK(submission_no>=0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,user_id,request_id),FOREIGN KEY(organization_id,user_id) REFERENCES ${t('memberships')}(organization_id,user_id),FOREIGN KEY(organization_id,project_id) REFERENCES ${t('projects')}(organization_id,id),FOREIGN KEY(organization_id,task_id,project_id) REFERENCES ${t('tasks')}(organization_id,id,project_id));
CREATE TABLE ${t('time_approvals')}(
 organization_id TEXT NOT NULL,id TEXT NOT NULL,entry_id TEXT NOT NULL,submission_no INTEGER NOT NULL,reviewed_version INTEGER NOT NULL,reviewer_id TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('APPROVE','REJECT')),note TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,entry_id,submission_no),FOREIGN KEY(organization_id,entry_id) REFERENCES ${t('time_entries')}(organization_id,id),FOREIGN KEY(organization_id,reviewer_id) REFERENCES ${t('memberships')}(organization_id,user_id));
CREATE INDEX platform_time_worker_date ON ${t('time_entries')}(organization_id,user_id,work_date);
CREATE INDEX platform_time_project_state ON ${t('time_entries')}(organization_id,project_id,status,work_date);
`;
}
const immutable=['organization_id','id','user_id','request_id','request_hash','created_at'];
const content=['project_id','task_id','work_date','minutes','billable','description'];
const transition="(OLD.status IN ('DRAFT','REJECTED') AND NEW.status IN (OLD.status,'SUBMITTED','VOID')) OR (OLD.status='SUBMITTED' AND NEW.status IN ('APPROVED','REJECTED'))";
const counters="NEW.version<>OLD.version+1 OR NEW.submission_no<>OLD.submission_no+(CASE WHEN NEW.status='SUBMITTED' THEN 1 ELSE 0 END)";
export function timeSqliteGuards(){return `
CREATE TRIGGER platform_time_guard BEFORE UPDATE ON platform_time_entries WHEN NOT (${transition}) OR ${counters} OR (${immutable.map(key=>`NEW.${key} IS NOT OLD.${key}`).join(' OR ')}) OR (OLD.status='SUBMITTED' AND (${content.map(key=>`NEW.${key} IS NOT OLD.${key}`).join(' OR ')})) BEGIN SELECT RAISE(ABORT,'Time entry state, version or protected content is immutable'); END;
${['UPDATE','DELETE'].map(op=>`CREATE TRIGGER platform_time_approvals_${op.toLowerCase()} BEFORE ${op} ON platform_time_approvals BEGIN SELECT RAISE(ABORT,'Time approvals are immutable'); END;`).join('\n')}
`;}
export function timePostgresGuards(){return `
CREATE FUNCTION novaworks.guard_time_entry() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT (${transition}) OR ${counters} OR (${immutable.map(key=>`NEW.${key} IS DISTINCT FROM OLD.${key}`).join(' OR ')}) OR (OLD.status='SUBMITTED' AND (${content.map(key=>`NEW.${key} IS DISTINCT FROM OLD.${key}`).join(' OR ')})) THEN RAISE EXCEPTION 'Time entry state, version or protected content is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_time_guard BEFORE UPDATE ON novaworks.platform_time_entries FOR EACH ROW EXECUTE FUNCTION novaworks.guard_time_entry();
CREATE FUNCTION novaworks.guard_time_approval() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Time approvals are immutable'; END $$;
CREATE TRIGGER platform_time_approval_guard BEFORE UPDATE OR DELETE ON novaworks.platform_time_approvals FOR EACH ROW EXECUTE FUNCTION novaworks.guard_time_approval();
REVOKE ALL ON FUNCTION novaworks.guard_time_entry(),novaworks.guard_time_approval() FROM PUBLIC;
`;}
export function timeRlsSql(){return timeTables.map(name=>{
 const table=`novaworks.platform_${name}`,scope="organization_id=NULLIF(current_setting('app.organization_id',true),'')";
 return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON ${table} FOR SELECT USING (${scope});
CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${scope});
${name==='time_entries'?`CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${scope}) WITH CHECK (${scope});`:''}
REVOKE ALL ON ${table} FROM PUBLIC;`;
 }).join('\n');}
