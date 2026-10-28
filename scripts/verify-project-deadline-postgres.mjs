// Disposable loopback PostgreSQL proof for project/task deadline lock ordering.
// Never reads DATABASE_URL, hosted credentials, or prints the local password.
import pg from '../backend/node_modules/pg/lib/index.js';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createTaskService} from '../backend/src/modules/projects/taskService.js';
import {billingConfiguration} from '../backend/src/platform/billing/policy.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const portable='E:/Projects/Hackathon/tmp/novaworks-analysis-20261019/tmp/pg-portable';
const password=(await readFile(join(portable,'password.txt'),'utf8')).trim();
const config={host:'127.0.0.1',port:5432,user:'nw_test_admin',password,ssl:false,connectionTimeoutMillis:5000};
if(config.host!=='127.0.0.1'||config.port!==5432)throw new Error('Refusing non-loopback PostgreSQL target');
const stamp=Date.now(),database=`nw_deadline_${stamp}`,role=`nw_deadline_rt_${stamp}`,runtimePassword=randomUUID();
const output=resolve(root,`tmp/project-deadline-postgres-${stamp}`);await mkdir(output,{recursive:true});
const numbered=sql=>{let i=0;return sql.replaceAll('?',()=>`$${++i}`);};
function adapter(pool,{beforeQuery=async()=>{},afterQuery=async()=>{}}={}){
 return{kind:'postgres',query:(sql,values=[])=>pool.query(numbered(sql),values),transaction:async work=>{
  const client=await pool.connect();try{await client.query('BEGIN');const connection={query:async(sql,values=[])=>{await beforeQuery(sql);const result=await client.query(numbered(sql),values);await afterQuery(sql);return result;}};const result=await work(connection);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function waitFor(signal,label){let timer;try{await Promise.race([signal.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out; parent-row lock was not observed`)),5000);})]);}finally{clearTimeout(timer);}}
const matchesProjectLock=sql=>/^SELECT \* FROM novaworks\.platform_projects WHERE organization_id=\$1 AND id=\$2 FOR UPDATE$/i.test(sql);
const matchesTaskParentLock=sql=>/^SELECT \* FROM novaworks\.platform_projects WHERE organization_id=\$1 AND id=\$2 FOR UPDATE$/i.test(sql);
const evidence={result:'FAIL',database,role,billingEnabled:false,checks:[]};
const control=new pg.Client({...config,database:'postgres'});let admin,runtime;let controlConnected=false,databaseCreated=false,roleCreated=false;
try{
 await control.connect();controlConnected=true;
 const collision=await control.query('SELECT 1 FROM pg_database WHERE datname=$1 UNION ALL SELECT 1 FROM pg_roles WHERE rolname=$2',[database,role]);assert.equal(collision.rowCount,0,'Generated disposable database or role already exists');
 await control.query(`CREATE DATABASE "${database}"`);databaseCreated=true;
 admin=new pg.Pool({...config,database});
 await admin.query(await readFile(join(root,'backend/migrations/001_postgres.sql'),'utf8'));
 const db=adapter(admin);await migratePlatform(db);
 let provision=(await readFile(join(root,'backend/scripts/provision-runtime.sql'),'utf8')).replace(/^\\.*$/gm,'').replace(/:'runtime_role'/g,`'${role}'`);
 await admin.query(provision);roleCreated=true;await admin.query(`ALTER ROLE "${role}" PASSWORD '${runtimePassword}'`);
 runtime=new pg.Pool({...config,database,user:role,password:runtimePassword,max:6});
 const runtimeDb=adapter(runtime),platform=createPlatformService(runtimeDb),owner=await platform.register({name:'Deadline race owner',email:`owner-${stamp}@deadline.test`,password:'DisposableDeadlineTest2026!'}),member=await platform.register({name:'Deadline race member',email:`member-${stamp}@deadline.test`,password:'DisposableDeadlineTest2026!'}),org=await platform.createOrganization(owner.id,{name:'Disposable deadline race company'});
 const invitation=await platform.invite(owner.id,org.id,{email:member.email,role:'MEMBER'});await platform.acceptInvitation(member.id,org.id,invitation.token);
 assert.equal(billingConfiguration(runtimeDb).enabled,false);evidence.billingEnabled=false;

 async function projectWithTask(suffix,withTask){
  const item=await platform.createProject(owner.id,org.id,{name:`Race ${suffix}`,deadline:'2027-04-30'});
  const tasks=createTaskService(runtimeDb);let task=null;
  if(withTask)task=await tasks.create(owner.id,org.id,{projectId:item.id,title:'Existing task',description:'Disposable test row',assigneeId:owner.id,deadline:'2027-04-10',estimatedHours:1});
  return{item,task,tasks};
 }
 async function race({label,taskWriter,projectDeadline,taskDeadline,withExistingTask}){
  const {item,task,tasks}=await projectWithTask(label,withExistingTask);
  const lockReached=deferred(),releaseLock=deferred(),blockedWriter=deferred();
  const hold=async sql=>{if(matchesProjectLock(sql)){lockReached.resolve();await releaseLock.promise;}};
  const observeBlocked=async sql=>{if(matchesProjectLock(sql))blockedWriter.resolve();};
  let taskService,projectService;
  const heldAdapter=adapter(runtime,{afterQuery:hold});
  const waitingAdapter=adapter(runtime,{beforeQuery:observeBlocked});
  if(taskWriter){taskService=createTaskService(heldAdapter);projectService=createPlatformService(waitingAdapter);}
  else{projectService=createPlatformService(heldAdapter);taskService=createTaskService(waitingAdapter);}
  let taskPromise,projectPromise;
  if(taskWriter){
   taskPromise=task?taskService.update(owner.id,org.id,task.id,{deadline:taskDeadline,version:task.version}):taskService.create(owner.id,org.id,{projectId:item.id,title:'New task',description:'Disposable test row',assigneeId:owner.id,deadline:taskDeadline,estimatedHours:1});
   await waitFor(lockReached,`${label} task lock`);
   projectPromise=projectService.updateProject(owner.id,org.id,item.id,{deadline:projectDeadline,version:item.version});
   await waitFor(blockedWriter,`${label} project waiter`);releaseLock.resolve();
   const [taskResult,projectResult]=await Promise.allSettled([taskPromise,projectPromise]);
   assert.equal(taskResult.status,'fulfilled',`${label}: task writer should commit first`);
   assert.equal(projectResult.status,'rejected',`${label}: project correction must reject incompatible saved task`);
   assert.equal(projectResult.reason.code,'BAD_DEADLINE');
   evidence.checks.push(`${label}: task writer commits before project; incompatible correction rejected`);
  }else{
   projectPromise=projectService.updateProject(owner.id,org.id,item.id,{deadline:projectDeadline,version:item.version});
   await waitFor(lockReached,`${label} project lock`);
   taskPromise=task?taskService.update(owner.id,org.id,task.id,{deadline:taskDeadline,version:task.version}):taskService.create(owner.id,org.id,{projectId:item.id,title:'New task',description:'Disposable test row',assigneeId:owner.id,deadline:taskDeadline,estimatedHours:1});
   await waitFor(blockedWriter,`${label} task waiter`);releaseLock.resolve();
   const [projectResult,taskResult]=await Promise.allSettled([projectPromise,taskPromise]);
   assert.equal(projectResult.status,'fulfilled',`${label}: project correction should commit first`);
   assert.equal(taskResult.status,'rejected',`${label}: task writer must validate against corrected parent`);
   assert.equal(taskResult.reason.code,'BAD_DEADLINE');
   evidence.checks.push(`${label}: project correction commits before task; later task date rejected`);
  }
 }
 await race({label:'task create wins',taskWriter:true,projectDeadline:'2027-04-15',taskDeadline:'2027-04-20',withExistingTask:false});
 await race({label:'project wins over task create',taskWriter:false,projectDeadline:'2027-04-15',taskDeadline:'2027-04-20',withExistingTask:false});
 await race({label:'task update wins',taskWriter:true,projectDeadline:'2027-04-15',taskDeadline:'2027-04-20',withExistingTask:true});
 await race({label:'project wins over task update',taskWriter:false,projectDeadline:'2027-04-15',taskDeadline:'2027-04-20',withExistingTask:true});
 const memberProject=await platform.createProject(owner.id,org.id,{name:'Assigned member status project',deadline:'2027-04-30'});
 const memberTask=await createTaskService(runtimeDb).create(owner.id,org.id,{projectId:memberProject.id,title:'Assigned member task',description:'Disposable status-permission check',assigneeId:member.id,deadline:'2027-04-20',estimatedHours:1});
 const memberEdit=await createTaskService(runtimeDb).update(member.id,org.id,memberTask.id,{status:'DONE',version:memberTask.version});
 assert.deepEqual([memberEdit.status,memberEdit.version],['DONE',2]);
 evidence.checks.push('restricted MEMBER can update status on assigned task while project parent lock is enforced');
 evidence.result='PASS';
}catch(error){evidence.error={name:error?.name??'Error',code:error?.code??null,message:String(error?.message??'Verification failed').slice(0,300)};throw error;
}finally{
 await Promise.allSettled([runtime?.end(),admin?.end()]);
 if(controlConnected){
  if(databaseCreated){try{await control.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);}catch{}}
  if(roleCreated){try{await control.query(`DROP ROLE IF EXISTS "${role}"`);}catch{}}
  await control.end();
 }
 await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify(evidence,null,2));
