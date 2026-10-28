import {readFileSync} from 'node:fs';
import {openDatabase} from '../backend/src/db/database.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createApp} from '../backend/src/app.js';
import {ApiError} from '../backend/src/middleware/errorHandler.js';
const db=openDatabase('data/subscription-development.sqlite');await migratePlatform(db);
const policy=JSON.parse(readFileSync(new URL('../backend/test/fixtures/subscription-policy.json',import.meta.url),'utf8'));
const disabled=async()=>{throw new ApiError(503,'AI_NOT_CONFIGURED','Provider calls are disabled in the subscription verification preview');};
createApp({db,erpEnabled:true,billingOptions:{enabled:true,policy},paddleWebhookSecret:'subscription-browser-fixture-signing-secret-only',extract:disabled,companyAiOptions:{extract:disabled},sessionSecret:'subscription-preview-session-secret-at-least-32',frontendOrigin:'http://127.0.0.1:3027',production:false}).listen(3027,'127.0.0.1',()=>console.log('Subscription test-policy preview http://127.0.0.1:3027 — no checkout, live charge or AI provider'));
