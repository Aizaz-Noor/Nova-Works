import {createPrivateFileStorage} from '../backend/src/modules/files/privateStorage.js';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openDatabase} from '../backend/src/db/database.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createPlatformService} from '../backend/src/platform/service.js';
import {randomUUID} from 'node:crypto';
import {createCommentService} from '../backend/src/modules/projects/commentService.js';
import {createTaskService} from '../backend/src/modules/projects/taskService.js';
import {createApp} from '../backend/src/app.js';
await mkdir('tmp',{recursive:true});const output=await mkdtemp(resolve('tmp/task-attachments-browser-')),db=openDatabase(resolve(output,'fixture.sqlite'));await migratePlatform(db);
const p=createPlatformService(db),password='comment-browser-test-password',user=await p.register({name:'Delivery Owner',email:'comments-browser@example.test',password}),org=await p.createOrganization(user.id,{name:'Fictional Comments Company'}),project=await p.createProject(user.id,org.id,{name:'Website delivery'}),task=await createTaskService(db).create(user.id,org.id,{projectId:project.id,title:'Review homepage',description:'Confirm the revised scope',assigneeId:user.id,deadline:'2027-01-01',estimatedHours:2});
const server=createApp({db,attachmentOptions:{storage:await createPrivateFileStorage({root:resolve(output,"private")})},erpEnabled:true,sessionSecret:'comments-browser-session-secret-fixture-only',frontendOrigin:'http://127.0.0.1:3046',production:false}).listen(3046,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});page.setDefaultTimeout(15000);const evidence={result:'FAIL',viewports:[],checks:[]},errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3046');await page.getByLabel('Email address',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Current company',{exact:true}).selectOption(org.id);await page.getByRole('heading',{name:'Company tasks',exact:true}).waitFor();await page.getByText('Task attachments',{exact:true}).click();await page.getByText('No attachments yet. Add a supporting document or image.',{exact:true}).waitFor();
 const bytes=Buffer.from('Approved delivery scope\nPrivate task evidence.'),name='delivery-scope.txt';await page.getByLabel('Choose task attachment',{exact:true}).setInputFiles({name,mimeType:'text/plain',buffer:bytes});await page.getByRole('button',{name:'Upload attachment',exact:true}).click();await page.getByRole('button',{name:'Download '+name,exact:true}).waitFor();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+name,exact:true}).click();const file=await downloading;assert.equal(file.suggestedFilename(),name);await file.saveAs(resolve(output,'download.txt'));assert.deepEqual(await readFile(resolve(output,'download.txt')),bytes);
 await page.getByLabel('Choose task attachment',{exact:true}).setInputFiles({name:'forged.pdf',mimeType:'application/pdf',buffer:Buffer.from('This is not a PDF')});await page.getByRole('button',{name:'Upload attachment',exact:true}).click();await page.getByRole('alert').filter({hasText:'matching PDF'}).waitFor();assert.equal(await page.getByRole('button',{name:'Download forged.pdf',exact:true}).count(),0);
 for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(output,`attachments-${width}.png`),fullPage:true});evidence.viewports.push({width,overflow:false});}
 await page.reload();await page.getByRole('heading',{name:'Company tasks',exact:true}).waitFor();await page.getByText('Task attachments',{exact:true}).click();await page.getByRole('button',{name:'Download '+name,exact:true}).waitFor();assert.deepEqual(errors,[]);evidence.result='PASS';evidence.checks=['actual login/company/task upload persists real private bytes','authenticated UI download matches exact uploaded bytes','forged PDF rejected with recovery feedback and no saved row','reload preserves attachment;5widths320–1440 no overflow'];
}catch(error){evidence.error=error.message;await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{evidence.pageErrors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));db.close();console.log(JSON.stringify({output,...evidence},null,2));}
