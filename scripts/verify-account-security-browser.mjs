import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {openDatabase} from '../backend/src/db/database.js';
import {configureBilling} from '../backend/src/platform/billing/policy.js';
import {createBillingService} from '../backend/src/platform/billing/service.js';
import {createApp} from '../backend/src/app.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
const db=openDatabase('data/security-development.sqlite');await migratePlatform(db);
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8'));let records={},outage=false;
const server=createApp({db,erpEnabled:true,billingOptions:{enabled:true,policy},billingProvider:{getSubscription:async id=>{if(outage)throw new Error('fixture outage');return structuredClone(records[id]);}},sessionSecret:'billing-recovery-browser-session-fixture-only',frontendOrigin:'http://127.0.0.1:3030',production:false}).listen(3030,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),base='http://127.0.0.1:3030',output=resolve('tmp/security-browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[],evidence={checks:[],viewports:[],result:'FAIL'};page.on('pageerror',e=>errors.push(e.message));
async function api(path,method='GET',body){return page.evaluate(async({path,method,body})=>{const r=await fetch('/api/v1'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};},{path,method,body});}
async function views(screen){for(const width of [1366,768,375,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${screen} ${width}`);await page.screenshot({path:resolve(output,`${screen}-${width}.png`),fullPage:true});evidence.viewports.push({screen,width,overflow});}await page.setViewportSize({width:1366,height:900});}
try{
 await page.goto(base);await page.getByRole('button',{name:'Create ERP account',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Subscription Browser Owner');await page.getByLabel('Email',{exact:true}).fill(`subscription-${Date.now()}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Subscription-browser-test-password-2026');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('heading',{name:'ERP Workspace',exact:true}).waitFor();await page.locator('summary').filter({hasText:'Create a company'}).click();await page.getByLabel('Company name',{exact:true}).fill('Recovery Fictional Company');await page.getByRole('button',{name:'Create company',exact:true}).click();await page.getByText('Account security',{exact:true}).click();await page.getByLabel('Current password',{exact:true}).fill('wrong-password');await page.getByLabel('New password',{exact:true}).fill('changed-security-browser-password');await page.getByLabel('Confirm new password',{exact:true}).fill('changed-security-browser-password');await views('password-form');await page.getByRole('button',{name:'Change password and sign out',exact:true}).click();await page.getByRole('alert').filter({hasText:'Current password is incorrect'}).waitFor();await page.getByLabel('Current password',{exact:true}).fill('Subscription-browser-test-password-2026');await page.getByRole('button',{name:'Change password and sign out',exact:true}).click();await page.getByLabel('Email address',{exact:true}).waitFor();assert.equal((await api('/context')).status,401);assert.deepEqual(errors,[]);evidence.result='PASS';evidence.checks.push('rendered wrong-password error retains form, successful change signs out, subsequent authenticated request401');
}catch(e){evidence.error=e.message;await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw e;}
finally{evidence.pageErrors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));db.close();}
console.log(JSON.stringify(evidence,null,2));
