import {randomUUID} from 'node:crypto';
import {ApiError} from '../middleware/errorHandler.js';
const projects=`SELECT p.id,p.name,p.client_name AS "clientName",p.description,p.manager_id AS "managerId",p.deadline::text AS deadline,p.created_at AS "createdAt",u.name AS "managerName",u.specialization AS "managerSpecialization" FROM novaworks.projects p JOIN novaworks.users u ON u.id=p.manager_id`;
const tasks=`SELECT t.id,t.project_id AS "projectId",t.title,t.description,t.assignee_id AS "assigneeId",t.deadline::text AS deadline,t.estimated_hours AS "estimatedHours",t.created_at AS "createdAt",u.name AS "assigneeName",p.name AS "projectName",p.manager_id AS "managerId" FROM novaworks.tasks t JOIN novaworks.projects p ON p.id=t.project_id JOIN novaworks.users u ON u.id=t.assignee_id`;
function access(user,args){if(user.role==='ADMIN')return 'TRUE';args.push(user.id);const n=args.length;return user.role==='MANAGER'?`p.manager_id=$${n}`:`EXISTS(SELECT 1 FROM novaworks.tasks a WHERE a.project_id=p.id AND a.assignee_id=$${n})`;}
export async function teamDirectory(db){return (await db.query('SELECT id,name,role,specialization,skills FROM novaworks.users ORDER BY id')).rows;}
export async function listProjects(db,user){const args=[];return (await db.query(`${projects} WHERE ${access(user,args)} ORDER BY p.created_at,p.id`,args)).rows;}
export async function listTasks(db,user,projectId){const args=[];let where='TRUE';if(user.role==='MANAGER'){args.push(user.id);where='p.manager_id=$1';}else if(user.role==='AGENT'){args.push(user.id);where='t.assignee_id=$1';}if(projectId){args.push(projectId);where+=` AND t.project_id=$${args.length}`;}return(await db.query(`${tasks} WHERE ${where} ORDER BY t.created_at,t.id`,args)).rows;}
export async function getProject(db,user,id){const args=[id];const row=(await db.query(`${projects} WHERE p.id=$1 AND ${access(user,args)}`,args)).rows[0];if(!row)throw new ApiError(404,'NOT_FOUND','Project not found');return {...row,manager:{id:row.managerId,name:row.managerName,specialization:row.managerSpecialization},tasks:await listTasks(db,user,id)};}
export async function previousSubmission(db,hash){return (await db.query('SELECT result_json FROM novaworks.transcript_submissions WHERE hash=$1',[hash])).rows[0]?.result_json||null;}
export async function saveDraft(db,draft,hash){return db.transaction(async client=>{
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[hash]);
 const previous=await previousSubmission(client,hash);if(previous)return {...previous,replayed:true};
 const result={success:true,replayed:false,projectCount:draft.projects.length,taskCount:0,projects:[]};
 for(const p of draft.projects){const id=randomUUID();await client.query('INSERT INTO novaworks.projects(id,name,client_name,description,manager_id,deadline) VALUES($1,$2,$3,$4,$5,$6)',[id,p.name,p.clientName,p.description,p.managerId,p.deadline]);
 for(const t of p.tasks){await client.query('INSERT INTO novaworks.tasks(id,project_id,title,description,assignee_id,deadline,estimated_hours) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,t.title,t.description,t.assigneeId,t.deadline,t.estimatedHours]);result.taskCount++;}
 result.projects.push(await getProject(client,{role:'ADMIN'},id));}
 await client.query('INSERT INTO novaworks.transcript_submissions(hash,result_json) VALUES($1,$2::jsonb)',[hash,JSON.stringify(result)]);return result;
});}
