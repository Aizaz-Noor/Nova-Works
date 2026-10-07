import { ApiError } from '../middleware/errorHandler.js';
export function validDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function validateAiOutput(value,directory) {
 const issues=[];const roles=new Map(directory.map(u=>[u.id,u.role]));
 const issue=(path,message)=>issues.push({path,message});
 const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
 const text=(v,path)=>{if(typeof v!=='string'||!v.trim()||v.length>10000)issue(path,'Required non-empty text (maximum 10000 characters)');};
 const description=(v,path)=>{if(v!==undefined&&(typeof v!=='string'||v.length>20000))issue(path,'Description must be text (maximum 20000 characters)');};
 const extras=(v,allowed,path)=>{for(const k of Object.keys(v))if(!allowed.includes(k))issue(`${path}.${k}`,'Unexpected field');};
 if(!object(value)) issue('root','Expected a JSON object');
 else {
  extras(value,['projects'],'root');
  if(!Array.isArray(value.projects)||value.projects.length<1||value.projects.length>50)issue('projects','Expected 1–50 projects');
  else value.projects.forEach((p,i)=>{
   const path=`projects[${i}]`;
   if(!object(p)){issue(path,'Expected a project object');return;}
   extras(p,['name','clientName','description','managerId','deadline','tasks'],path);
   text(p.name,`${path}.name`);text(p.clientName,`${path}.clientName`);description(p.description,`${path}.description`);
   if(roles.get(p.managerId)!=='MANAGER')issue(`${path}.managerId`,'Must reference an existing MANAGER');
   if(!validDate(p.deadline))issue(`${path}.deadline`,'Expected a real date in YYYY-MM-DD format');
   if(!Array.isArray(p.tasks)||p.tasks.length<1||p.tasks.length>100)issue(`${path}.tasks`,'Expected 1–100 tasks');
   else p.tasks.forEach((t,j)=>{
    const tp=`${path}.tasks[${j}]`;
    if(!object(t)){issue(tp,'Expected a task object');return;}
    extras(t,['title','description','assigneeId','deadline','estimatedHours'],tp);
    text(t.title,`${tp}.title`);if(typeof t.description!=='string'||!t.description.trim()||t.description.length>20000)issue(`${tp}.description`,'Required non-empty task description (maximum 20000 characters)');
    if(roles.get(t.assigneeId)!=='AGENT')issue(`${tp}.assigneeId`,'Must reference an existing AGENT');
    if(!validDate(t.deadline))issue(`${tp}.deadline`,'Expected a real date in YYYY-MM-DD format');
    else if(validDate(p.deadline)&&t.deadline>p.deadline)issue(`${tp}.deadline`,'Task deadline must not exceed project deadline');
    if(typeof t.estimatedHours!=='number'||!Number.isFinite(t.estimatedHours)||t.estimatedHours<=0)issue(`${tp}.estimatedHours`,'Expected positive numeric hours');
   });
  });
 }
 if(issues.length)throw new ApiError(422,'INVALID_AI_OUTPUT','AI result requires correction; nothing was saved',issues);
 return {projects:value.projects.map(p=>({...p,name:p.name.trim(),clientName:p.clientName.trim(),description:p.description||'',tasks:p.tasks.map(t=>({...t,title:t.title.trim(),description:t.description||''}))}))};
}
