import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../scripts/provision-runtime.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/001_postgres.sql',import.meta.url),'utf8');
test('provisioning rejects elevated roles, membership, ownership and inherited permanent DDL',()=>{
 for(const check of ['attrs.rolsuper','attrs.rolcreatedb','attrs.rolcreaterole','attrs.rolreplication','attrs.rolbypassrls','attrs.rolinherit','pg_auth_members WHERE member=runtime_id','nspowner=runtime_id','relowner=runtime_id','datdba=runtime_id',"has_schema_privilege(role_name,'novaworks','CREATE')","has_schema_privilege(role_name,'public','CREATE')","has_database_privilege(role_name,current_database(),'CREATE')","has_table_privilege(role_name,c.oid,'TRUNCATE')"])assert.ok(sql.includes(check),check);
 assert.match(sql,/ON_ERROR_STOP on/);assert.match(sql,/BEGIN;/);assert.match(sql,/COMMIT;/);assert.match(sql,/set_config\('novaworks.provision_role', :'runtime_role', true\)/);assert.doesNotMatch(sql,/PASSWORD\s+'|GRANT\s+ALL|TO\s+PUBLIC|BYPASSRLS\s*;/i);
});
test('legacy RLS gets only explicit operation policies targeted to the dedicated role',()=>{
 const matrix=Object.fromEntries([...sql.matchAll(/\('([a-z_]+)','(SELECT(?:,INSERT)?(?:,UPDATE)?(?:,DELETE)?)'\)/g)].map(match=>[match[1],match[2].split(',')]));
 assert.deepEqual(matrix,{users:['SELECT','INSERT'],projects:['SELECT','INSERT'],tasks:['SELECT','INSERT'],transcript_submissions:['SELECT','INSERT'],sessions:['SELECT','INSERT','UPDATE','DELETE'],request_limits:['SELECT','INSERT','UPDATE','DELETE'],ai_drafts:['SELECT','INSERT','UPDATE']});
 for(const table of ['users','projects','tasks','transcript_submissions','sessions','request_limits'])assert.ok(migration.includes(`ALTER TABLE novaworks.${table} ENABLE ROW LEVEL SECURITY`));
 assert.match(sql,/FOR INSERT TO %I WITH CHECK \(true\)/);assert.match(sql,/FOR UPDATE TO %I USING \(true\) WITH CHECK \(true\)/);assert.match(sql,/FOR %s TO %I USING \(true\)/);
});
test('tenant grants preserve fail-closed RLS and do not grant migration-history writes',()=>{
 const section=sql.slice(sql.indexOf('-- Keep company policies'));
 assert.match(section,/c\.relrowsecurity AND c\.relforcerowsecurity/);assert.doesNotMatch(section,/CREATE POLICY|DISABLE ROW LEVEL SECURITY|NO FORCE ROW LEVEL SECURITY/);
 assert.match(section,/GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE/);assert.doesNotMatch(sql,/GRANT .*platform_migrations|ALTER DEFAULT PRIVILEGES|GRANT .*ALL SEQUENCES/);
});
