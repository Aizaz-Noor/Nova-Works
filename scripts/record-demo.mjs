// Optional maintainer tool. Requires a locally installed Playwright package/browser.
// Run against scripts/start-recording-server.mjs, never reset shared/public data for filming.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const {chromium} = modulePath ? await import(pathToFileURL(resolve(modulePath)).href) : await import('playwright');
const base = process.env.DEMO_URL || 'http://127.0.0.1:3008';
const output = resolve(process.env.DEMO_CAPTURE_DIR || 'tmp/demo-capture');
await mkdir(output,{recursive:true});await mkdir('docs/assets',{recursive:true});
const browser = await chromium.launch({channel:process.env.DEMO_BROWSER || 'msedge',headless:true,args:['--disable-gpu']});
const context = await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:output,size:{width:1280,height:720}}});
const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const begin = Date.now();const scenes=[];let processing;
const mark = text => {const time=(Date.now()-begin)/1000;scenes.push({time,text});console.log(`SCENE ${time.toFixed(1)} ${text}`);};
const hold = seconds => page.waitForTimeout(seconds*1000);
const signIn = async name => { await page.locator('#email').fill(`${name}@novaworks.example`);await page.locator('#password').fill('Demo123!');await page.locator('form button').click();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();await page.locator('.loading').waitFor({state:'hidden'}); };
try {
 await page.goto(base);await page.locator('#email').waitFor();
 mark('NovaWorks: meeting decisions become assigned work');await hold(5);
 await signIn('admin');mark('An administrator creates work for the team');await hold(4);
 await page.getByRole('button',{name:'Create from Transcript',exact:true}).click();
 await page.getByRole('button',{name:'Load sample meeting',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#transcript')?.value.length>1000);
 mark('Use the complete meeting, including final corrections');await page.locator('#transcript').scrollIntoViewIfNeeded();await hold(5);
 const requestStart=(Date.now()-begin)/1000;
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/admin/create-from-transcript')&&r.request().method()==='POST',{timeout:115000});
 mark('Actual AI request: extract, validate, then save together');
 await page.locator('.composer-footer button').click();
 const response=await responsePromise;const result=await response.json();assert.equal(response.status(),201,`Extraction failed: ${result.error?.code || 'unexpected status'}`);assert.equal(result.replayed,false);assert.equal(result.projectCount,3);assert.equal(result.taskCount,12);
 const expected=JSON.parse(await readFile('backend/test/fixtures/expected.json','utf8'));
 const canonical=d=>d.projects.map(p=>({name:p.name,clientName:p.clientName,managerId:p.managerId,deadline:p.deadline,tasks:p.tasks.map(t=>({title:t.title,assigneeId:t.assigneeId,deadline:t.deadline,estimatedHours:t.estimatedHours})).sort((a,b)=>a.title.localeCompare(b.title))})).sort((a,b)=>a.name.localeCompare(b.name));
 assert.deepEqual(canonical(result),canonical(expected));
 await page.locator('.notice.success').waitFor();await page.locator('.loading').waitFor({state:'hidden'});await page.evaluate(()=>scrollTo(0,0));
 processing={start:requestStart,end:(Date.now()-begin)/1000};mark('Three projects and twelve tasks saved from a real request');await hold(6);
 await page.locator('.list-summary .text-button').count().then(async n=>{if(n)await page.locator('.list-summary .text-button').click();});
 await page.screenshot({path:'docs/assets/projects.png',fullPage:true});
 mark('Find client work by project, client or manager');await page.locator('#project-search').fill('UrbanCart');await hold(4);
 await page.locator('.project-card').click();await page.locator('#task-search').waitFor();mark('Project scope, manager and agreed delivery date');await hold(5);await page.screenshot({path:'docs/assets/project-detail.png',fullPage:true});
 await page.locator('#task-search').fill('integration');await page.locator('.task-row').first().scrollIntoViewIfNeeded();mark('Every task has an owner, deadline and effort estimate');await hold(6);
 await page.locator('nav button').filter({hasText:'Team directory'}).click();await page.locator('#team-role').waitFor();await page.locator('#team-role').selectOption('MANAGER');mark('A searchable, read-only directory of the supplied team');await hold(5);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#email').waitFor();await signIn('ayesha');assert.equal(await page.locator('.project-card').count(),1);mark('Managers see their assigned projects');await hold(6);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#email').waitFor();await signIn('ali');await page.locator('#task-search').waitFor();assert.equal(await page.locator('.task-row').count(),3);assert.equal(await page.locator('#task-assignee').count(),0);mark('Developers see their own tasks, not everyone else’s');await hold(6);
 await page.setViewportSize({width:375,height:720});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);mark('Responsive menu and assigned work — 375 pixels');await page.getByRole('button',{name:'Menu',exact:true}).click();await hold(2);await page.keyboard.press('Escape');await page.locator('.task-row').first().scrollIntoViewIfNeeded();await page.screenshot({path:'docs/assets/mobile-tasks.png',fullPage:true});await hold(5);
 await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#email').waitFor();await page.screenshot({path:'docs/assets/login.png',fullPage:true});mark('Try the live demo. Explore the code. Share your feedback.');await hold(6);
 assert.deepEqual(errors,[],'No uncaught browser errors');
 const duration=(Date.now()-begin)/1000;await context.close();const raw=await page.video().path();
 await writeFile(resolve(output,'capture.json'),JSON.stringify({base,recordedDate:'2026-10-08',fictional:true,actualAI:true,counts:{projects:3,tasks:12},processing,scenes,duration,raw,browserErrors:errors},null,2));console.log(`CAPTURE_PASS ${duration.toFixed(1)}s ${raw}`);
} finally {await context.close().catch(()=>{});await browser.close();}