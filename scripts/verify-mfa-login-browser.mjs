import {createPlatformService} from '../backend/src/platform/service.js';
import {createMfaService} from '../backend/src/platform/mfa/service.js';
import {createMfaCipher,totpCode} from '../backend/src/platform/mfa/crypto.js';
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
const db=openDatabase('data/mfa-login-development.sqlite');await migratePlatform(db);
const policy=JSON.parse(await readFile('backend/test/fixtures/subscription-policy.json','utf8'));let records={},outage=false;
const fixtureEmail=`mfa-browser-${Date.now()}@example.test`,fixturePassword='mfa-browser-test-password',fixtureUser=await createPlatformService(db).register({name:'MFA Browser Fixture',email:fixtureEmail,password:fixturePassword});let mfaClock=Date.now();const mfaOptions={cipher:createMfaCipher({activeKeyId:'fixture',keys:{fixture:Buffer.alloc(32,61)}}),clock:()=>mfaClock},mfa=createMfaService(db,mfaOptions),enrollment=await mfa.begin(fixtureUser.id,fixturePassword);await mfa.confirm(fixtureUser.id,{password:fixturePassword,pendingId:enrollment.pendingId,code:totpCode(enrollment.secret,{timeMs:mfaClock})});mfaClock+=30000;
const server=createApp({db,erpEnabled:true,mfaOptions,billingOptions:{enabled:true,policy},billingProvider:{getSubscription:async id=>{if(outage)throw new Error('fixture outage');return structuredClone(records[id]);}},sessionSecret:'billing-recovery-browser-session-fixture-only',frontendOrigin:'http://127.0.0.1:3033',production:false}).listen(3033,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),base='http://127.0.0.1:3033',output=resolve('tmp/mfa-login-browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[],evidence={checks:[],viewports:[],result:'FAIL'};page.on('pageerror',e=>errors.push(e.message));
async function api(path,method='GET',body){return page.evaluate(async({path,method,body})=>{const r=await fetch('/api/v1'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};},{path,method,body});}
async function views(screen){for(const width of [1366,768,375,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${screen} ${width}`);await page.screenshot({path:resolve(output,`${screen}-${width}.png`),fullPage:true});evidence.viewports.push({screen,width,overflow});}await page.setViewportSize({width:1366,height:900});}
try{
 await page.goto(base);await page.getByLabel('Email address',{exact:true}).fill(fixtureEmail);await page.getByLabel('Password',{exact:true}).fill(fixturePassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Authenticator or recovery code',{exact:true}).waitFor();assert.equal((await api('/organizations')).status,401);await views('challenge');await page.getByLabel('Authenticator or recovery code',{exact:true}).fill(totpCode(enrollment.secret,{timeMs:mfaClock}));await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'ERP Workspace',exact:true}).waitFor();assert.equal((await api('/organizations')).status,200);assert.deepEqual(errors,[]);evidence.result='PASS';evidence.checks.push('actual login password prompts authenticator, business API401 before proof, code sign-in and business API200','fixture enrollment through internal service only; no public enrollment or real authenticator claim');
}catch(e){evidence.error=e.message;await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw e;}
finally{evidence.pageErrors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));db.close();}
console.log(JSON.stringify(evidence,null,2));
