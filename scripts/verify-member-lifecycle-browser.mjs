import {configureBilling} from '../backend/src/platform/billing/policy.js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile,mkdtemp,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openDatabase} from '../backend/src/db/database.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {createApp} from '../backend/src/app.js';
await mkdir('tmp',{recursive:true});
const output=await mkdtemp(resolve('tmp/member-lifecycle-browser-')),db=openDatabase(resolve(output,'fixture.sqlite'));
await migratePlatform(db);
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8'));configureBilling(db,{enabled:true,policy});
const p=createPlatformService(db),password='member-browser-fixture-password';
const owner=await p.register({name:'Company Owner',email:'owner@members.test',password}),org=await p.createOrganization(owner.id,{name:'Fictional Membership Company'}),other=await p.createOrganization(owner.id,{name:'Other Fictional Company'});
const people={};
for(const [key,name,role] of [['admin','Admin One','ADMIN'],['admin2','Admin Two','ADMIN'],['member','Member Target','MEMBER']]){const person=await p.register({name,email:`${key}@members.test`,password});people[key]=person;for(const company of [org,other]){const invite=await p.invite(owner.id,company.id,{email:person.email,role});await p.acceptInvitation(person.id,company.id,invite.token);}}
await p.createProject(owner.id,org.id,{name:'Protected company project'});
await p.createProject(owner.id,other.id,{name:'Other company project'});
const server=createApp({db,erpEnabled:true,billingOptions:{enabled:true,policy},sessionSecret:'member-browser-fixture-only-secret',frontendOrigin:'http://127.0.0.1:3047',production:false}).listen(3047,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],evidence={result:'FAIL',checks:[],viewports:[]};
async function newPage(){const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));return page;}
const page=await newPage(),memberPage=await newPage(),adminPage=await newPage();
async function login(target,person,company=org){await target.goto('http://127.0.0.1:3047');await target.getByLabel('Email address',{exact:true}).fill(person.email);await target.getByLabel('Password',{exact:true}).fill(password);await target.getByRole('button',{name:'Sign in',exact:true}).click();await target.getByLabel('Current company',{exact:true}).selectOption(company.id);await target.getByRole('heading',{name:'Company tasks',exact:true}).waitFor();}
async function api(target,path,method='GET',body){return target.evaluate(async({path,method,body})=>{const r=await fetch('/api/v1'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};},{path,method,body});}
const panel=target=>target.locator('details').filter({has:target.locator('summary').filter({hasText:'Company member controls'})});
const row=(target,name)=>panel(target).locator('article').filter({has:target.getByRole('heading',{name,exact:true})});
async function open(target){await target.getByText('Company member controls',{exact:true}).click();await panel(target).getByRole('heading',{name:'Member Target',exact:true}).waitFor();}
async function saved(target,name,role,status){await row(target,name).getByText(new RegExp(`Saved: ${role} · ${status} · Version`)).waitFor();}
try{
 await login(page,owner);await login(memberPage,people.member);await login(adminPage,people.admin);
 await open(page);assert.equal(await row(page,'Company Owner').getByRole('button',{name:'Save member changes',exact:true}).count(),0);
 const target=row(page,'Member Target');await target.getByRole('combobox',{name:'Company access',exact:true}).selectOption('SUSPENDED');assert.equal(await target.getByRole('button',{name:'Save member changes',exact:true}).isDisabled(),true);await target.getByLabel('Suspend company access only',{exact:true}).check();await target.getByRole('button',{name:'Save member changes',exact:true}).click();await saved(page,'Member Target','Member','Suspended');
 assert.equal((await api(memberPage,'/projects')).status,403);assert.equal((await api(memberPage,'/organizations/select','POST',{organizationId:other.id})).status,200);assert.equal((await api(memberPage,'/projects')).status,200);evidence.checks.push('owner suspension requires explicit company-only confirmation; selected member session immediately403, other company remains200');
 await target.getByRole('combobox',{name:'Company access',exact:true}).selectOption('ACTIVE');await target.getByRole('button',{name:'Save member changes',exact:true}).click();await saved(page,'Member Target','Member','Active');assert.equal((await api(memberPage,'/organizations/select','POST',{organizationId:org.id})).status,200);assert.equal((await api(memberPage,'/projects')).status,200);evidence.checks.push('owner reactivation restores same logged-in member session without deleting records');
 await target.getByRole('combobox',{name:'Company role',exact:true}).selectOption('ADMIN');
 let listing=await api(page,'/member-administration');let member=listing.body.members.find(m=>m.user_id===people.member.id);
 assert.equal((await api(page,`/member-administration/${people.member.id}/transition`,'POST',{version:member.version,role:'MANAGER',status:'ACTIVE'})).status,200);
 await target.getByRole('button',{name:'Save member changes',exact:true}).click();await panel(page).getByRole('alert').filter({hasText:'Your proposed values are retained'}).waitFor();assert.equal(await target.getByRole('combobox',{name:'Company role',exact:true}).inputValue(),'ADMIN');assert.equal(await target.getByRole('button',{name:'Save member changes',exact:true}).isDisabled(),true);
 await panel(page).getByRole('button',{name:'Reload saved members',exact:true}).click();await saved(page,'Member Target','Manager','Active');assert.equal(await target.getByRole('combobox',{name:'Company role',exact:true}).inputValue(),'ADMIN');await target.getByRole('button',{name:'Use saved version and keep proposed values',exact:true}).click();await target.getByRole('button',{name:'Save member changes',exact:true}).click();await saved(page,'Member Target','Admin','Active');evidence.checks.push('actual second mutation creates409; proposed Admin retained through reload; explicit version adoption then save succeeds');
 await target.getByRole('combobox',{name:'Company role',exact:true}).selectOption('MEMBER');await target.getByRole('button',{name:'Save member changes',exact:true}).click();await saved(page,'Member Target','Member','Active');
 await open(adminPage);assert.equal(await row(adminPage,'Admin Two').getByRole('button',{name:'Save member changes',exact:true}).count(),0);assert.deepEqual(await row(adminPage,'Member Target').getByRole('combobox',{name:'Company role',exact:true}).locator('option').evaluateAll(options=>options.map(o=>o.value)),['MANAGER','MEMBER']);
 listing=await api(adminPage,'/member-administration');let secondAdmin=listing.body.members.find(m=>m.user_id===people.admin2.id);assert.equal((await api(adminPage,`/member-administration/${people.admin2.id}/transition`,'POST',{version:secondAdmin.version,role:'MANAGER',status:'ACTIVE'})).status,403);evidence.checks.push('admin cannot edit another Admin, owner, or self; proposed roles exclude Admin; direct forged Admin transition403');
 listing=await api(page,'/member-administration');secondAdmin=listing.body.members.find(m=>m.user_id===people.admin2.id);assert.equal((await api(page,`/member-administration/${people.admin2.id}/transition`,'POST',{version:secondAdmin.version,role:'ADMIN',status:'SUSPENDED'})).status,200);
 await page.reload();await page.getByRole('heading',{name:'Company tasks',exact:true}).waitFor();await page.getByRole('navigation',{name:'Company modules',exact:true}).getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('heading',{name:'Customers',exact:true}).waitFor();await page.getByText('Add a customer',{exact:true}).click();assert.equal(await page.locator('#crm-new-owner option').filter({hasText:'Admin Two'}).count(),0);assert.equal(await page.locator('#crm-new-owner option').filter({hasText:'Admin One'}).count(),1);
 await page.getByRole('navigation',{name:'Company modules',exact:true}).getByRole('button',{name:'Pipeline',exact:true}).click();await page.getByRole('heading',{name:'Sales pipeline',exact:true}).waitFor();assert.equal(await page.locator('#pipeline-owner option').filter({hasText:'Admin Two'}).count(),0);assert.equal(await page.locator('#pipeline-owner option').filter({hasText:'Admin One'}).count(),1);evidence.checks.push('customer and pipeline assignment options omit actual suspended Admin while retaining active Admin');
 db.prepare("UPDATE platform_subscriptions SET valid_until='2000-01-01T00:00:00.000Z' WHERE organization_id=?").run(org.id);
 await page.reload();await page.getByRole('heading',{name:'Company tasks',exact:true}).waitFor();await open(page);
 await row(page,'Member Target').getByRole('combobox',{name:'Company role',exact:true}).selectOption('MANAGER');await row(page,'Member Target').getByRole('button',{name:'Save member changes',exact:true}).click();await saved(page,'Member Target','Manager','Active');assert.equal((await api(page,'/projects','POST',{name:'Denied expired company project'})).status,402);evidence.checks.push('expired subscription retains member-maintenance controls and real role transition while business writes stay restricted');
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`member controls overflow ${width}`);await page.screenshot({path:resolve(output,`member-controls-${width}.png`),fullPage:true});evidence.viewports.push({width,overflow:false});}
 assert.deepEqual(errors,[]);evidence.result='PASS';
}catch(error){evidence.error=error.message;await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{evidence.pageErrors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));db.close();console.log(JSON.stringify({output,...evidence},null,2));}
