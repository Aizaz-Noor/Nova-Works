import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base=process.argv[2]||'https://nova-works-zeta.vercel.app';
if(new URL(base).protocol!=='https:')throw new Error('Use an HTTPS deployed URL');
function client(){let cookie='';return async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(115000)});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return{status:r.status,body:await r.json()};};}
async function login(c,name){const r=await c('/api/auth/login','POST',{email:`${name}@novaworks.example`,password:'Demo123!'});assert.equal(r.status,200,`Login failed: ${r.body.error?.code}`);}
const admin=client(),pm=client(),agent=client();
try{
 assert.equal((await admin('/api/health')).status,200);
 await login(admin,'admin');assert.equal((await admin('/api/auth/me')).body.role,'ADMIN');
 assert.equal((await admin('/api/team')).body.team.length,10);
 assert.equal((await admin('/api/admin/create-from-transcript','POST',{transcript:''})).status,400);
 const transcript=await readFile(new URL('../docs/meeting-transcript.txt',import.meta.url),'utf8');
 const made=await admin('/api/admin/create-from-transcript','POST',{transcript});
 assert.ok([200,201].includes(made.status),`Creation failed: ${made.body.error?.code} ${made.body.error?.message}`);
 assert.equal(made.body.projectCount,3);assert.equal(made.body.taskCount,12);
 const expected=JSON.parse(await readFile(new URL('../test/fixtures/expected.json',import.meta.url),'utf8'));
 const canonical=draft=>draft.projects.map(p=>({name:p.name,clientName:p.clientName,managerId:p.managerId,deadline:p.deadline,tasks:p.tasks.map(t=>({title:t.title,assigneeId:t.assigneeId,deadline:t.deadline,estimatedHours:t.estimatedHours})).sort((a,b)=>a.title.localeCompare(b.title))})).sort((a,b)=>a.name.localeCompare(b.name));
 assert.deepEqual(canonical(made.body),canonical(expected),'Saved official fields must match final agreed decisions');
 const repeat=await admin('/api/admin/create-from-transcript','POST',{transcript});assert.equal(repeat.status,200);assert.equal(repeat.body.replayed,true);
 const ids=made.body.projects.map(p=>p.id);const urban=made.body.projects.find(p=>p.managerId==='PM01');const quick=made.body.projects.find(p=>p.managerId==='PM02');
 assert.equal((await admin('/api/projects')).body.projects.filter(p=>ids.includes(p.id)).length,3);
 await login(pm,'ayesha');const visible=(await pm('/api/projects')).body.projects;assert.ok(visible.every(p=>p.managerId==='PM01'));assert.equal((await pm(`/api/projects/${quick.id}`)).status,404);
 assert.equal((await pm('/api/admin/create-from-transcript','POST',{transcript:'test'})).status,403);
 await login(agent,'ali');const own=(await agent('/api/tasks')).body.tasks;assert.ok(own.every(t=>t.assigneeId==='DEV01'));assert.equal(own.filter(t=>ids.includes(t.projectId)).length,3);
 assert.equal((await agent(`/api/projects/${urban.id}`)).body.tasks.length,3);assert.equal((await agent(`/api/projects/${quick.id}`)).status,404);
 await admin('/api/auth/logout','POST');assert.equal((await admin('/api/auth/me')).status,401);await login(admin,'admin');assert.equal((await admin('/api/projects')).body.projects.filter(p=>ids.includes(p.id)).length,3);
 await admin('/api/auth/logout','POST');await pm('/api/auth/logout','POST');await agent('/api/auth/logout','POST');
 console.log(JSON.stringify({result:'PASS',base,flow:'health/login/directory/AI creation/replay/persistence/role restrictions/direct access/logout',projectCount:3,taskCount:12,reusedExisting:made.body.replayed}));
}catch(error){console.error('FAIL deployed workflow:',error.message);process.exitCode=1;}
