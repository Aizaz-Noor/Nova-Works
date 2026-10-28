import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright module');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const base=process.env.DEMO_URL||'http://127.0.0.1:3019';
const output=resolve('tmp/erp-browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900}});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const suffix=Date.now();const email=`browser-${suffix}@example.test`;const password='Browser-only-test-password-2026';
const evidence={base,startedAt:new Date().toISOString(),checks:[]};
try{
 await page.goto(base);await page.getByRole('button',{name:'Create ERP account',exact:true}).click();
 await page.getByLabel('Your name').fill('Browser Owner');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('heading',{name:'ERP Workspace',exact:true}).waitFor();
 await page.locator('summary').filter({hasText:'Create a company'}).click();await page.getByLabel('Company name',{exact:true}).fill(`Browser Agency ${suffix}`);
 await page.getByRole('button',{name:'Create company',exact:true}).click();await page.getByRole('heading',{name:'Company projects',exact:true}).waitFor();
 await page.locator('summary').filter({hasText:'Create a project'}).click();await page.getByLabel('Project name',{exact:true}).fill('Client onboarding');await page.getByLabel('Project description',{exact:true}).fill('Verified browser workflow');
 await page.getByRole('button',{name:'Create project',exact:true}).click();await page.getByRole('heading',{name:'Client onboarding',exact:true}).waitFor();
 await page.getByLabel('Project status',{exact:true}).selectOption('ACTIVE');await page.getByText('Project status updated to Active.',{exact:true}).waitFor();
 await page.locator('summary').filter({hasText:'Assign a task'}).click();
 await page.getByLabel('Task title',{exact:true}).fill('Deliver client kickoff');await page.getByLabel('Task description',{exact:true}).fill('Confirm the kickoff requirements and delivery owner.');await page.getByLabel('Task deadline',{exact:true}).fill('2027-01-20');await page.getByLabel('Estimated hours',{exact:true}).fill('4');
 await page.getByRole('button',{name:'Save assignment',exact:true}).click();await page.getByRole('heading',{name:'Deliver client kickoff',exact:true}).waitFor();await page.getByLabel('Status of Deliver client kickoff',{exact:true}).selectOption('IN_PROGRESS');await page.getByText('Task status saved.',{exact:true}).waitFor();
 evidence.checks.push('registration, organization creation/selection, project creation and status update','company task assignment and in-progress status saved');
 for(const width of [1366,768,375,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(output,`workspace-${width}.png`),fullPage:true});evidence.checks.push(`no document overflow at ${width}px`);}
 await page.reload();await page.getByRole('heading',{name:'Client onboarding',exact:true}).waitFor();assert.equal(await page.getByLabel('Project status',{exact:true}).inputValue(),'ACTIVE');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'ERP Workspace',exact:true}).waitFor();
 await page.getByLabel('Current company',{exact:true}).selectOption({label:`Browser Agency ${suffix} · Owner`});await page.getByRole('heading',{name:'Client onboarding',exact:true}).waitFor();
 evidence.checks.push('refresh and signout/signin preserve organization project/status');assert.deepEqual(errors,[]);evidence.pageErrors=errors;evidence.result='PASS';
}catch(error){evidence.result='FAIL';evidence.error=error.message;await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{await writeFile(resolve(output,'results.json'),JSON.stringify(evidence,null,2));await context.close();await browser.close();}
console.log(JSON.stringify(evidence,null,2));
