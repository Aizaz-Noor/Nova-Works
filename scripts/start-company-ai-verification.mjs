// Explicit local test adapter. Never imported by production startup.
import {openDatabase} from '../backend/src/db/database.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createApp} from '../backend/src/app.js';
import {companyAiFixture as extract} from './company-ai-fixture.mjs';
const db=openDatabase('data/company-ai-development.sqlite');await migratePlatform(db);
createApp({db,erpEnabled:true,companyAiFixture:true,companyAiOptions:{extract,dailyLimit:20},sessionSecret:'company-ai-local-fixture-secret-at-least-32',frontendOrigin:'http://127.0.0.1:3025',production:false}).listen(3025,'127.0.0.1',()=>console.log('Company AI fixture preview http://127.0.0.1:3025 — no live provider calls'));
