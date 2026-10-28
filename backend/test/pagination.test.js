import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openDatabase} from '../src/db/database.js';
import {seedUsers} from '../src/db/seed.js';
import {saveDraft} from '../src/services/projectService.js';
import {paginatedList,parsePagination} from '../src/services/pagination.js';
import {createApp} from '../src/app.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expected.json',import.meta.url)));
function setup(){const db=openDatabase(':memory:');seedUsers(db);saveDraft(db,fixture,'pagination-fixture');return db;}
test('SQL pages and totals preserve manager and agent scope',async()=>{
 const db=setup();try{const admin={role:'ADMIN'};const first=await paginatedList(db,admin,'projects',{limit:'2'});const second=await paginatedList(db,admin,'projects',{limit:'2',page:'2'});assert.equal(first.projects.length,2);assert.deepEqual(first.pagination,{page:1,limit:2,total:3,totalPages:2});assert.equal(second.projects.length,1);assert.equal(new Set([...first.projects,...second.projects].map(p=>p.id)).size,3);
 const manager=await paginatedList(db,{role:'MANAGER',id:'PM01'},'projects',{limit:'1'});assert.equal(manager.pagination.total,1);assert.equal(manager.projects[0].managerId,'PM01');
 const agent=await paginatedList(db,{role:'AGENT',id:'DEV01'},'tasks',{limit:'2'});assert.equal(agent.pagination.total,3);assert.ok(agent.tasks.every(t=>t.assigneeId==='DEV01'));
 const excluded=await paginatedList(db,{role:'AGENT',id:'DEV01'},'tasks',{assigneeId:'DEV02'});assert.equal(excluded.pagination.total,0);assert.deepEqual(excluded.tasks,[]);
 }finally{db.close();}
});
test('literal wildcard search, filters, sorting and empty pages are bounded',async()=>{
 const db=setup();try{assert.equal((await paginatedList(db,{role:'ADMIN'},'projects',{q:'%'})).pagination.total,0);assert.equal((await paginatedList(db,{role:'ADMIN'},'tasks',{q:'_'})).pagination.total,0);const team=await paginatedList(db,{},'team',{role:'MANAGER',sort:'name',order:'desc',limit:'2'});assert.equal(team.pagination.total,3);assert.equal(team.team.length,2);assert.ok(team.team[0].name>team.team[1].name);assert.ok(Array.isArray(team.team[0].skills));assert.equal((await paginatedList(db,{role:'ADMIN'},'projects',{page:'100'})).projects.length,0);assert.equal((await paginatedList(db,{role:'ADMIN'},'tasks',{q:'urbanCart'})).pagination.total,4);}finally{db.close();}
});
test('invalid limits, compound query values and unsafe sort fail with 400',()=>{
 for(const query of [{limit:'101'},{limit:'0'},{page:'-1'},{page:'1.5'},{sort:'name;DROP TABLE users'},{order:'sideways'},{q:['a','b']},{page:'9007199254740992'}])assert.throws(()=>parsePagination(query),e=>e.status===400);
});
test('HTTP list supplies metadata and rejects invalid page',async()=>{
 const db=setup();const server=createApp({db,sessionSecret:'pagination-test-session-secret-long-enough'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'ali@novaworks.example',password:'Demo123!'})});const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};const response=await fetch(base+'/api/tasks?limit=1&page=2',{headers});assert.equal(response.status,200);const body=await response.json();assert.equal(body.tasks.length,1);assert.equal(body.pagination.total,3);assert.equal(body.pagination.page,2);assert.equal((await fetch(base+'/api/projects?limit=101',{headers})).status,400);}finally{await new Promise(r=>server.close(r));db.close();}
});
