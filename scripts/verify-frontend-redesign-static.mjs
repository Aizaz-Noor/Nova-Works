import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateOverviewReport} from '../app/client/src/overviewModel.js';

// Trusted existing tooling only. Static React HTML, not browser/visual evidence.
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(pathToFileURL(resolve(root,'app/client/package.json')));
const {build}=require('esbuild');
const result=await build({
 stdin:{contents:`import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DeliveryVisuals,SalesFlow,StatusVisual} from './src/ReportVisuals.jsx';
import OverviewWorkspace from './src/OverviewWorkspace.jsx';
import {CompanyRequestProvider} from './src/api.js';
export function render(name,props){const component=React.createElement({DeliveryVisuals,SalesFlow,StatusVisual,OverviewWorkspace}[name],props);return renderToStaticMarkup(React.createElement(CompanyRequestProvider,{organizationId:props.organization?.id||'static-company'},component));}`,
 resolveDir:resolve(root,'app/client'),sourcefile:'frontend-static-check.jsx',loader:'jsx'},
 bundle:true,write:false,platform:'node',format:'cjs',loader:{'.css':'empty'},logLevel:'silent'
});
const compiled={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(require,compiled,compiled.exports);
const {render}=compiled.exports;
const huge='900719925474099312345';
const checks=[];
function check(name,run){run();checks.push(name);}
const deliveryEnvelope={kind:'delivery',organizationId:'static-company',scope:'company',generatedAt:'2026-10-23T00:00:00.000Z',projects:[],tasks:[],approvedTime:{minutes:'0',billable_minutes:'0'}};
check('snapshot validation distinguishes valid zero records from missing and malformed exact values',()=>{
 assert.equal(validateOverviewReport(deliveryEnvelope,'delivery'),deliveryEnvelope);
 for(const minutes of [undefined,null,'','1.5','-1',Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>validateOverviewReport({...deliveryEnvelope,approvedTime:{minutes,billable_minutes:'0'}},'delivery'));
 }
 for(const changed of [{tasks:null},{approvedTime:null},{kind:'sales'},{generatedAt:'invalid'}]){
  assert.throws(()=>validateOverviewReport({...deliveryEnvelope,...changed},'delivery'));
 }
});
const delivery={projects:[{status:'ACTIVE',count:huge}],tasks:[{status:'TODO',count:huge},{status:'DONE',count:'1'}],approvedTime:{minutes:huge,billable_minutes:'61'}};
const html=render('DeliveryVisuals',{report:delivery});
check('delivery keeps very large counts exact in visible labels and SVG descriptions',()=>{
 assert.ok(html.includes(huge));assert.ok(html.includes(`To do: ${huge}`));
 assert.ok(html.includes((BigInt(huge)+1n).toLocaleString()));
});
check('approved minutes and hour/minute conversion remain exact',()=>{
 assert.ok(html.includes(`${huge} minutes (${BigInt(huge)/60n}h ${BigInt(huge)%60n}m)`));
 assert.ok(html.includes('61 minutes (1h 1m)'));
});
check('charts expose named SVG descriptions, a values control and truthful status semantics',()=>{
 assert.match(html,/<svg[^>]*role="img"[^>]*aria-labelledby=/);
 assert.match(html,/<title id="[^"]+">Task distribution<\/title>/);
 assert.match(html,/<desc id="[^"]+">[^<]*not measured work completion/);
 assert.match(html,/<button[^>]*aria-pressed="false"[^>]*>Show values<\/button>/);
});
check('integer-scaled chart geometry stays finite for beyond-safe-integer counts',()=>assert.doesNotMatch(html,/NaN|Infinity|undefined/));
const empty=render('DeliveryVisuals',{report:{projects:[],tasks:[],approvedTime:{minutes:'0',billable_minutes:'0'}}});
check('valid zero data has explanatory empty states and exact approved zero',()=>{
 assert.equal((empty.match(/No records in this scope yet\./g)||[]).length,2);
 assert.ok(empty.includes('0 minutes (0h 0m)'));assert.doesNotMatch(empty,/<svg/);
});
const sales=render('SalesFlow',{report:{deals:[{count:huge}],quotes:[{count:'2'}],orders:[{count:'3'}]}});
check('sales keeps stage counts independent and disclaims inferred conversion',()=>{
 assert.ok(sales.includes(huge));assert.ok(sales.includes('Current quotes'));assert.ok(sales.includes('Sales orders'));
 assert.ok(sales.includes('does not measure conversion rates'));assert.ok(sales.includes('amounts must not be added'));
});
for(const role of ['OWNER','ADMIN','MANAGER','MEMBER']){
 const overview=render('OverviewWorkspace',{organization:{id:'static-company',name:'Static company',role},billing:{enabled:false},onNavigate:()=>{}});
 check(`initial ${role} Overview HTML exposes only role-permitted sections and workspace actions`,()=>{
  assert.match(overview,/<section[^>]*class="overview-workspace"[^>]*aria-labelledby="overview-title"/);
  assert.doesNotMatch(overview,/<main/);
  for(const text of ['Projects &amp; tasks','Timesheets','Reports','Settings'])assert.ok(overview.includes(text));
  assert.equal(overview.includes('Current sales records'),role!=='MEMBER');
  assert.equal(overview.includes('Issued invoice balances'),['OWNER','ADMIN'].includes(role));
  assert.equal(overview.includes('>Pipeline '),role!=='MEMBER');
  assert.equal(overview.includes('>Invoices '),['OWNER','ADMIN'].includes(role));
 });
 check(`initial ${role} Overview HTML does not fabricate numeric snapshots before effects`,()=>{
  assert.ok(overview.includes('Loading this snapshot'));
  assert.doesNotMatch(overview,/<strong>0<\/strong>|0h 0m|USD 0\.00/);
 });
}
console.log(JSON.stringify({result:'PASS',layer:'static React HTML only',checks,limits:['No effects executed','No API request orchestration','No CSS layout, contrast, keyboard or reflow evidence','No browser launched']},null,2));
