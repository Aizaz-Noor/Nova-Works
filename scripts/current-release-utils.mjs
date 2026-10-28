import {createHash} from 'node:crypto';

const quoteIdentifier=value=>`"${String(value).replaceAll('"','""')}"`;
export const digestText=value=>createHash('sha256').update(value).digest('hex');
export const safeIdentifier=value=>/^[a-z][a-z0-9_]{0,62}$/.test(value);

// Stable row order and JSON key order make this usable before/after a pg_dump restore.
export async function snapshotSchema(client,{normalizeVersions=false}={}){
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='novaworks' ORDER BY tablename")).rows.map(row=>row.tablename);
 const snapshot={};
 for(const table of tables){
  const rows=(await client.query(`SELECT to_jsonb(t) AS row FROM novaworks.${quoteIdentifier(table)} t`)).rows.map(item=>item.row);
  const kept=rows.filter(row=>!(normalizeVersions&&table==='platform_migrations'&&String(row.version).startsWith('025_')));
  if(normalizeVersions&&['platform_projects','platform_tasks'].includes(table))for(const row of kept)delete row.version;
  const canonical=kept.map(row=>JSON.stringify(row)).sort();
  snapshot[table]={count:String(canonical.length),sha256:digestText(canonical.join('\n'))};
 }
 return snapshot;
}

export async function captureSecurityMetadata(client){
 const queries={
  schema:"SELECT nspname,pg_get_userbyid(nspowner) owner,COALESCE(nspacl,acldefault('n',nspowner))::text acl FROM pg_namespace WHERE nspname='novaworks'",
  objects:`SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) owner,
   CASE WHEN c.relkind IN ('r','p','v','m','f') THEN COALESCE(c.relacl,acldefault('r',c.relowner))::text
        WHEN c.relkind='S' THEN COALESCE(c.relacl,acldefault('s',c.relowner))::text ELSE NULL END acl,
   c.relrowsecurity,c.relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' ORDER BY c.relname`,
  functions:"SELECT p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_userbyid(p.proowner) owner,COALESCE(p.proacl,acldefault('f',p.proowner))::text acl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='novaworks' ORDER BY p.proname",
  policies:"SELECT * FROM pg_policies WHERE schemaname='novaworks' ORDER BY tablename,policyname",
  triggers:"SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
  grants:`SELECT c.relname table_name,grantor.rolname grantor,COALESCE(grantee.rolname,'PUBLIC') grantee,
   x.privilege_type,x.is_grantable
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,CASE WHEN c.relkind='S' THEN acldefault('s',c.relowner) ELSE acldefault('r',c.relowner) END)) x
   LEFT JOIN pg_roles grantor ON grantor.oid=x.grantor LEFT JOIN pg_roles grantee ON grantee.oid=x.grantee
   WHERE n.nspname='novaworks' AND c.relkind IN ('r','p','v','m','f','S')
   ORDER BY c.relname,grantor,grantee,x.privilege_type`,
  columnGrants:"SELECT c.relname,a.attname,a.attacl::text acl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL ORDER BY c.relname,a.attnum",
  defaultAcls:`SELECT pg_get_userbyid(d.defaclrole) owner_role,n.nspname schema_name,d.defaclobjtype,d.defaclacl::text acl
   FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
   WHERE d.defaclnamespace=0 OR n.nspname='novaworks' ORDER BY owner_role,schema_name,d.defaclobjtype`,
  sequences:"SELECT schemaname,sequencename,sequenceowner,data_type,start_value,min_value,max_value,increment_by,cycle,last_value FROM pg_sequences WHERE schemaname='novaworks' ORDER BY sequencename",
  roleReferences:`WITH refs(oid) AS (
   SELECT nspowner FROM pg_namespace WHERE nspname='novaworks'
   UNION SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='novaworks'
   UNION SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='novaworks'
   UNION SELECT a.grantee FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname='novaworks'
   UNION SELECT a.grantee FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE n.nspname='novaworks'
   UNION SELECT a.grantee FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='novaworks'
  ) SELECT DISTINCT r.rolname FROM refs JOIN pg_roles r ON r.oid=refs.oid ORDER BY r.rolname`,
 };
 const result={};for(const [key,sql] of Object.entries(queries))result[key]=(await client.query(sql)).rows;
 const roles=result.roleReferences.map(row=>row.rolname);
 result.roles=(await client.query('SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname',[roles])).rows;
 result.memberships=(await client.query(`SELECT r.rolname role_name,m.rolname member_name,a.admin_option,a.inherit_option,a.set_option
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
  WHERE r.rolname=ANY($1::text[]) OR m.rolname=ANY($1::text[]) ORDER BY r.rolname,m.rolname,a.grantor`,[roles])).rows;
 return result;
}

export function compareMappedMetadata(expected,actual,ownerMap={}){
 const mapOwner=value=>ownerMap[value]||value;
 const normalized=metadata=>{
  const copy=structuredClone(metadata);
  for(const row of copy.schema)row.owner=mapOwner(row.owner);
  for(const row of copy.objects)row.owner=mapOwner(row.owner);
  for(const row of copy.functions)row.owner=mapOwner(row.owner);
  for(const row of copy.grants){row.grantor=mapOwner(row.grantor);row.grantee=mapOwner(row.grantee);}
  for(const row of copy.roles){row.rolname=mapOwner(row.rolname);for(const key of Object.keys(row))if(key!=='rolname')delete row[key];}
  for(const row of copy.roleReferences)row.rolname=mapOwner(row.rolname);
  return copy;
 };
 const left=normalized(expected),right=normalized(actual);
 // Memberships are evidence only: pg_dump does not own cluster-global memberships.
 delete left.memberships;delete right.memberships;
 return JSON.stringify(left)===JSON.stringify(right);
}

export function normalizeVersionHistory(rows){return rows.filter(row=>!String(row.version).startsWith('025_'));}

export function assertProtectedRoleMemberships(memberships,protectedRoleNames){
 const protectedNames=new Set(protectedRoleNames);
 for(const membership of memberships){
  if(protectedNames.has(membership.member_name))throw new Error('Protected role is a member of another role');
  if(!protectedNames.has(membership.role_name))continue;
  const allowed=membership.member_name==='postgres'&&membership.admin_option===true&&membership.inherit_option===false&&membership.set_option===false;
  if(!allowed)throw new Error('Unexpected inbound protected-role membership');
 }
 return true;
}
