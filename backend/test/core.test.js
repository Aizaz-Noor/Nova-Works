import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { seedUsers } from '../src/db/seed.js';
import { verifyPassword } from '../src/services/passwords.js';
import { teamDirectory,listProjects,listTasks,getProject,saveDraft,previousSubmission } from '../src/services/projectService.js';
import { validateAiOutput,validDate } from '../src/validators/aiOutput.js';
import { extractProjects } from '../src/services/aiService.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expected.json',import.meta.url)));
const draft=()=>structuredClone(fixture);
function setup(){const db=openDatabase(':memory:');seedUsers(db);return db;}
function count(db,table){return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;}

test('seed twice: ten unique users, hashed passwords and foreign keys',()=>{
 const db=setup();try {
  assert.equal(seedUsers(db),10);assert.equal(count(db,'users'),10);
  const users=db.prepare('SELECT * FROM users').all();
  assert.equal(users.filter(u=>u.role==='ADMIN').length,1);assert.equal(users.filter(u=>u.role==='MANAGER').length,3);assert.equal(users.filter(u=>u.role==='AGENT').length,6);
  for(const u of users){assert.notEqual(u.password_hash,'Demo123!');assert.ok(verifyPassword('Demo123!',u.password_hash));assert.equal(verifyPassword('wrong',u.password_hash),false);}
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
  assert.ok(teamDirectory(db).every(u=>!('password_hash' in u)&&!('email' in u)&&Array.isArray(u.skills)));
 }finally{db.close();}
});
test('RBAC queries: admin, managers, agents and inaccessible direct detail',()=>{
 const db=setup();try {
  const result=saveDraft(db,validateAiOutput(draft(),teamDirectory(db)),'original');
  assert.equal(result.projectCount,3);assert.equal(result.taskCount,12);
  const admin={id:'ADMIN',role:'ADMIN'},ayesha={id:'PM01',role:'MANAGER'},ali={id:'DEV01',role:'AGENT'},hamza={id:'DEV02',role:'AGENT'};
  assert.equal(listProjects(db,admin).length,3);assert.equal(listTasks(db,admin).length,12);
  assert.deepEqual(listProjects(db,ayesha).map(p=>p.name),['UrbanCart Website']);assert.equal(listTasks(db,ayesha).length,4);
  assert.equal(listTasks(db,ali).length,3);assert.equal(listProjects(db,ali).length,1);
  assert.equal(listTasks(db,hamza).length,2);assert.equal(listProjects(db,hamza).length,2);
  assert.equal(getProject(db,ali,result.projects[0].id).tasks.length,3);
  assert.equal(getProject(db,hamza,result.projects[0].id).tasks.length,1);
  for(const user of [ayesha,ali])assert.throws(()=>getProject(db,user,result.projects[1].id),e=>e.status===404);
  assert.equal(saveDraft(db,draft(),'original').replayed,true);assert.equal(count(db,'projects'),3);
 }finally{db.close();}
});
test('whole-draft validation rejects wrong roles, unknown employees, invalid dates/hours and extras',()=>{
 const db=setup();try {
  const mutations=[p=>p.projects[2].managerId='DEV01',p=>p.projects[1].tasks[0].assigneeId='PM01',p=>p.projects[2].tasks[3].assigneeId='Kamran',p=>p.projects[2].deadline='2026-02-30',p=>p.projects[2].tasks[3].deadline='2026-10-23',p=>p.projects[2].tasks[3].estimatedHours=0,p=>p.projects[2].tasks[3].estimatedHours='8',p=>p.projects[0].name=' ',p=>p.projects[0].tasks[0].cost=12,p=>p.projects=[]];
  for(const mutate of mutations){const p=draft();mutate(p);assert.throws(()=>validateAiOutput(p,teamDirectory(db)),e=>e.status===422&&e.issues.length>0);assert.equal(count(db,'projects'),0);assert.equal(count(db,'tasks'),0);}
  assert.equal(validDate('2026-2-01'),false);assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-02-29'),false);
 }finally{db.close();}
});
test('database insert failure rolls back all projects, tasks and submission marker',()=>{
 const db=setup();try {
  const p=draft();p.projects[2].tasks[3].assigneeId='missing';
  assert.throws(()=>saveDraft(db,p,'failure'));assert.equal(count(db,'projects'),0);assert.equal(count(db,'tasks'),0);assert.equal(previousSubmission(db,'failure'),null);
  assert.equal(saveDraft(db,draft(),'failure').taskCount,12);
 }finally{db.close();}
});
test('SQLite records and deduplication survive close/reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'novaworks-'));const file=join(dir,'demo.sqlite');let db;
 try {db=openDatabase(file);seedUsers(db);saveDraft(db,draft(),'persist');db.close();db=openDatabase(file);assert.equal(count(db,'users'),10);assert.equal(count(db,'projects'),3);assert.equal(count(db,'tasks'),12);assert.equal(previousSubmission(db,'persist').taskCount,12);}
 finally {db?.close();rmSync(dir,{recursive:true,force:true});}
});
test('TokenRouter receives actual transcript, safe directory and expected JSON shape',async()=>{
 let sent;const unsafe=[{id:'PM01',name:'Ayesha',role:'MANAGER',specialization:'Web PM',skills:['Web'],password_hash:'secret',session:'secret'}];
 const value=await extractProjects('A changed meeting input',unsafe,{apiKey:'test-key',model:'test-model',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.tokenrouter.com/v1/chat/completions');sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture)}}]})};}});
 assert.equal(value.projects.length,3);assert.equal(sent.response_format.type,'json_object');assert.ok(sent.messages[0].content.includes('Expected JSON schema:'));const input=JSON.parse(sent.messages[1].content);assert.equal(input.transcript,'A changed meeting input');assert.equal(input.directory[0].password_hash,undefined);assert.equal(input.directory[0].session,undefined);
});
test('provider errors, malformed JSON and missing configuration are sanitized',async()=>{
 await assert.rejects(extractProjects('t',[],{apiKey:'',model:'m'}),e=>e.status===503);
 for(const mock of [async()=>{throw Error('secret credential');},async()=>({ok:false,status:401}),async()=>({ok:true,json:async()=>({choices:[{message:{content:'not json'}}]})}),async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})})]) {
  await assert.rejects(extractProjects('t',[],{apiKey:'key',model:'m',fetchImpl:mock}),e=>[422,502].includes(e.status)&&!e.message.includes('secret credential'));
 }
});

test('required task descriptions reject missing, blank and oversized AI fields',()=>{const db=setup();try{for(const value of [undefined,'','   ','x'.repeat(20001)]){const result=draft();result.projects[0].tasks[0].description=value;assert.throws(()=>validateAiOutput(result,teamDirectory(db)),error=>error.status===422&&error.issues.some(issue=>issue.path==='projects[0].tasks[0].description'));assert.equal(count(db,'projects'),0);assert.equal(count(db,'tasks'),0);}}finally{db.close();}});
