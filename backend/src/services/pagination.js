import {ApiError} from '../middleware/errorHandler.js';
import {demoIdentityPredicate} from '../db/demoIdentity.js';
const bad=()=>new ApiError(400,'BAD_INPUT','Invalid pagination or filter parameters');
const sorts={projects:{createdAt:'p.created_at',name:'p.name',deadline:'p.deadline',clientName:'p.client_name'},tasks:{createdAt:'t.created_at',title:'t.title',deadline:'t.deadline',estimatedHours:'t.estimated_hours'},team:{id:'u.id',name:'u.name',role:'u.role',specialization:'u.specialization'}};
export function parsePagination(query={},kind='projects') {
 const integer=(key,fallback,max)=>{const value=query[key];if(value===undefined)return fallback;if(typeof value!=='string'||!/^\d+$/.test(value))throw bad();const number=Number(value);if(!Number.isSafeInteger(number)||number<1||number>max)throw bad();return number;};
 const limit=integer('limit',100,100),page=integer('page',1,1000000);
 const sort=query.sort??(kind==='team'?'id':'createdAt'),order=query.order??'asc';
 if(typeof sort!=='string'||!Object.hasOwn(sorts[kind],sort)||!['asc','desc'].includes(order))throw bad();
 if(query.q!==undefined&&(typeof query.q!=='string'||query.q.length>200))throw bad();
 return {page,limit,offset:(page-1)*limit,sort:sorts[kind][sort],order:order.toUpperCase(),q:query.q?.trim()||''};
}
export async function paginatedList(db,user,kind,query={}) {
 const options=parsePagination(query,kind),pg=db.kind==='postgres',schema=pg?'novaworks.':'';
 const args=[],bind=value=>{args.push(value);return pg?`$${args.length}`:'?';};
 const where=['1=1'];let from,fields,search,id;
 const date=alias=>pg?`${alias}.deadline::text`:`${alias}.deadline`;
 if(kind==='projects'){
  from=`${schema}projects p JOIN ${schema}users u ON u.id=p.manager_id`;id='p.id';
  fields=`p.id,p.name,p.client_name AS "clientName",p.description,p.manager_id AS "managerId",${date('p')} AS deadline,p.created_at AS "createdAt",u.name AS "managerName",u.specialization AS "managerSpecialization"`;
  search=['p.name','p.client_name','p.description','u.name'];
  if(user.role==='MANAGER')where.push(`p.manager_id=${bind(user.id)}`);
  else if(user.role!=='ADMIN')where.push(`EXISTS(SELECT 1 FROM ${schema}tasks a WHERE a.project_id=p.id AND a.assignee_id=${bind(user.id)})`);
 }else if(kind==='tasks'){
  from=`${schema}tasks t JOIN ${schema}projects p ON p.id=t.project_id JOIN ${schema}users u ON u.id=t.assignee_id`;id='t.id';
  fields=`t.id,t.project_id AS "projectId",t.title,t.description,t.assignee_id AS "assigneeId",${date('t')} AS deadline,t.estimated_hours AS "estimatedHours",t.created_at AS "createdAt",u.name AS "assigneeName",p.name AS "projectName",p.manager_id AS "managerId"`;
  search=['t.title','t.description','p.name','u.name'];
  if(user.role==='MANAGER')where.push(`p.manager_id=${bind(user.id)}`);
  else if(user.role!=='ADMIN')where.push(`t.assignee_id=${bind(user.id)}`);
 }else{
  from=`${schema}users u`;id='u.id';fields='u.id,u.name,u.role,u.specialization,u.skills';search=['u.name','u.specialization','u.role'];
  where.push(demoIdentityPredicate('u',bind));
 }
 const filters=kind==='projects'?{managerId:'p.manager_id'}:kind==='tasks'?{projectId:'t.project_id',assigneeId:'t.assignee_id'}:{role:'u.role'};
 for(const [key,column] of Object.entries(filters)){if(query[key]!==undefined){const value=query[key];if(typeof value!=='string'||!value.trim()||value.length>100||(key==='role'&&!['ADMIN','MANAGER','AGENT'].includes(value)))throw bad();where.push(`${column}=${bind(value.trim())}`);}}
 if(options.q){const literal=`%${options.q.toLowerCase().replace(/[!%_]/g,'!$&')}%`;where.push(`(${search.map(column=>`LOWER(${column}) LIKE ${bind(literal)} ESCAPE '!'`).join(' OR ')})`);}
 const predicate=where.join(' AND ');
 const countSql=`SELECT COUNT(*) AS total FROM ${from} WHERE ${predicate}`;
 const total=Number(pg?(await db.query(countSql,args)).rows[0].total:db.prepare(countSql).get(...args).total);
 // Stable tie-breakers prevent rows being repeated or omitted between pages.
 const tie=pg||kind==='team'?id:kind==='projects'?'p.rowid':'t.rowid';
 const sql=`SELECT ${fields} FROM ${from} WHERE ${predicate} ORDER BY ${options.sort} ${options.order},${tie} ${options.order} LIMIT ${bind(options.limit)} OFFSET ${bind(options.offset)}`;
 const rows=pg?(await db.query(sql,args)).rows:db.prepare(sql).all(...args);
 if(kind==='team'&&!pg)for(const row of rows)row.skills=JSON.parse(row.skills);
 return {[kind]:rows,pagination:{page:options.page,limit:options.limit,total,totalPages:Math.ceil(total/options.limit)}};
}
