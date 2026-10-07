// Genuine provider acceptance test. Reference answers exist only in test fixtures.
import '../src/config.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { seedUsers } from '../src/db/seed.js';
import { teamDirectory,saveDraft } from '../src/services/projectService.js';
import { validateAiOutput } from '../src/validators/aiOutput.js';
import { extractProjects } from '../src/services/aiService.js';
const original=readFileSync(new URL('../docs/meeting-transcript.txt',import.meta.url),'utf8');
// Replace all final mentions, including recap, so the modified input is internally consistent.
const changed=original.replace('Make the final estimate 10 hours. Keep the task deadline at 22 October.','Make the final estimate 12 hours. Move the task deadline to 23 October.')
 .replace('Mobile integration and testing, Usman, 10 hours, 22 October.','Mobile integration and testing, Usman, 12 hours, 23 October.')
 .replace(/Usman owns Mobile integration and testing:\s*10 hours, 22 October\./,'Usman owns Mobile integration and testing: 12 hours, 23 October.');
assert.notEqual(original,changed);
const expected=JSON.parse(readFileSync(new URL('../test/fixtures/expected.json',import.meta.url)));
function canonical(draft){return draft.projects.map(p=>({name:p.name,clientName:p.clientName,managerId:p.managerId,deadline:p.deadline,tasks:p.tasks.map(t=>({title:t.title,assigneeId:t.assigneeId,deadline:t.deadline,estimatedHours:t.estimatedHours})).sort((a,b)=>a.title.localeCompare(b.title))})).sort((a,b)=>a.name.localeCompare(b.name));}
const db=openDatabase(':memory:');seedUsers(db);
try {
 const directory=teamDirectory(db);
 const first=validateAiOutput(await extractProjects(original,directory),directory);
 assert.deepEqual(canonical(first),canonical(expected));
 assert.equal(saveDraft(db,first,'original').taskCount,12);
 console.log('PASS: genuine original transcript produced expected 3 projects and 12 tasks.');
 const second=validateAiOutput(await extractProjects(changed,directory),directory);
 const revised=structuredClone(expected);const task=revised.projects[1].tasks[3];task.estimatedHours=12;task.deadline='2026-10-23';
 assert.deepEqual(canonical(second),canonical(revised));assert.equal(saveDraft(db,second,'changed').taskCount,12);
 console.log('PASS: genuine changed transcript changed only QuickServe integration hours/date.');
} catch(error) {console.error(error.code ? `${error.code}: ${error.message}` : 'Acceptance failed: extracted fields do not match the reference. Inspect the provider output locally.');process.exitCode=1;}
finally {db.close();}
