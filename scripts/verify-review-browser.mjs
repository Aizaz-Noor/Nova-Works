import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
const output=resolve('tmp/review-browser');await mkdir(output,{recursive:true});
try{
 await page.goto('http://127.0.0.1:3020');await page.getByLabel('Email address',{exact:true}).fill('admin@novaworks.example');await page.getByLabel('Password',{exact:true}).fill('Demo123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Create from Transcript',exact:true}).click();await page.getByLabel('Meeting description or transcript').fill('Fixture acceptance meeting. No live model request.');await page.getByRole('button',{name:'Extract for review',exact:true}).click();await page.getByRole('heading',{name:'Review before saving',exact:true}).waitFor();
 const before=await page.evaluate(async()=>await(await fetch('/api/projects')).json());assert.equal(before.pagination.total,0);
 await page.getByLabel('Project name',{exact:true}).first().fill('Human reviewed project');
 for(const width of[1366,375,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`review overflow at ${width}`);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(output,`review-${width}.png`),fullPage:true});}
 await page.getByRole('button',{name:'Approve and save',exact:true}).click();await page.getByRole('heading',{name:'Human reviewed project',exact:true}).waitFor();
 const saved=await page.evaluate(async()=>await(await fetch('/api/projects')).json());assert.equal(saved.pagination.total,3);assert.equal((await page.evaluate(async()=>await(await fetch('/api/tasks')).json())).pagination.total,12);
 await page.setViewportSize({width:1366,height:900});await page.getByLabel('Find a project',{exact:true}).fill('Human reviewed project');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('heading',{name:'Human reviewed project',exact:true}).waitFor();
 assert.equal(await page.locator('.project-card').count(),1);assert.deepEqual(errors,[]);
 const result={result:'PASS',provider:'fixture only; no live AI request',checks:['zero records before approval','human-edited name persisted','3 projects and 12 tasks after approval','server search filters results','review no overflow at1366/375/320'],pageErrors:errors};await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}finally{await browser.close();}
