import { randomUUID } from 'node:crypto';
import { transaction } from '../db/database.js';
import { ApiError } from '../middleware/errorHandler.js';
export function teamDirectory(db) {
 return db.prepare('SELECT id,name,role,specialization,skills FROM users ORDER BY id').all().map(u => ({...u,skills:JSON.parse(u.skills)}));
}
const projectSelect = `SELECT p.id,p.name,p.client_name AS clientName,p.description,p.manager_id AS managerId,
 p.deadline,p.created_at AS createdAt,u.name AS managerName,u.specialization AS managerSpecialization
 FROM projects p JOIN users u ON u.id=p.manager_id`;
const taskSelect = `SELECT t.id,t.project_id AS projectId,t.title,t.description,t.assignee_id AS assigneeId,
 t.deadline,t.estimated_hours AS estimatedHours,t.created_at AS createdAt,
 u.name AS assigneeName,p.name AS projectName,p.manager_id AS managerId
 FROM tasks t JOIN projects p ON p.id=t.project_id JOIN users u ON u.id=t.assignee_id`;
function projectAccess(user) {
 if (user.role === 'ADMIN') return {sql:'1=1',args:[]};
 if (user.role === 'MANAGER') return {sql:'p.manager_id=?',args:[user.id]};
 return {sql:'EXISTS(SELECT 1 FROM tasks a WHERE a.project_id=p.id AND a.assignee_id=?)',args:[user.id]};
}
export function listProjects(db,user) {
 const access=projectAccess(user);
 return db.prepare(`${projectSelect} WHERE ${access.sql} ORDER BY p.created_at,p.rowid`).all(...access.args);
}
export function listTasks(db,user,projectId) {
 let sql='1=1'; const args=[];
 if (user.role==='MANAGER') {sql='p.manager_id=?';args.push(user.id);}
 else if (user.role==='AGENT') {sql='t.assignee_id=?';args.push(user.id);}
 if (projectId) {sql+=' AND t.project_id=?';args.push(projectId);}
 return db.prepare(`${taskSelect} WHERE ${sql} ORDER BY t.created_at,t.rowid`).all(...args);
}
export function getProject(db,user,id) {
 const access=projectAccess(user);
 const project=db.prepare(`${projectSelect} WHERE p.id=? AND ${access.sql}`).get(id,...access.args);
 if (!project) throw new ApiError(404,'NOT_FOUND','Project not found');
 return {...project,manager:{id:project.managerId,name:project.managerName,specialization:project.managerSpecialization},tasks:listTasks(db,user,id)};
}
export function previousSubmission(db,hash) {
 const row=db.prepare('SELECT result_json FROM transcript_submissions WHERE hash=?').get(hash);
 return row ? JSON.parse(row.result_json) : null;
}
// The caller must validate the entire draft first. The submission marker is committed with its records.
export function saveDraft(db,draft,hash) {
 return transaction(db, () => {
  const existing=previousSubmission(db,hash);
  if(existing) return {...existing,replayed:true};
  const insertProject=db.prepare('INSERT INTO projects(id,name,client_name,description,manager_id,deadline) VALUES(?,?,?,?,?,?)');
  const insertTask=db.prepare('INSERT INTO tasks(id,project_id,title,description,assignee_id,deadline,estimated_hours) VALUES(?,?,?,?,?,?,?)');
  const projects=[];let taskCount=0;
  for(const p of draft.projects) {
   const id=randomUUID();insertProject.run(id,p.name,p.clientName,p.description,p.managerId,p.deadline);
   for(const t of p.tasks) {insertTask.run(randomUUID(),id,t.title,t.description,t.assigneeId,t.deadline,t.estimatedHours);taskCount++;}
   projects.push(getProject(db,{role:'ADMIN'},id));
  }
  const result={success:true,replayed:false,projectCount:projects.length,taskCount,projects};
  db.prepare('INSERT INTO transcript_submissions(hash,result_json) VALUES(?,?)').run(hash,JSON.stringify(result));
  return result;
 });
}
