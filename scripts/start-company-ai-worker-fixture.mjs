// A separate local worker process for acceptance; never a production entry point.
import {openDatabase} from '../backend/src/db/database.js';
import {startCompanyAiWorker} from '../backend/src/modules/companyAi/worker.js';
import {companyAiFixture} from './company-ai-fixture.mjs';
const userId=process.argv[2];if(!/^[\da-f-]{36}$/i.test(userId||''))throw new Error('Provide a local fixture owner UUID');
const db=openDatabase('data/company-ai-development.sqlite');
const worker=startCompanyAiWorker(db,{userId,intervalMs:100,serviceOptions:{extract:companyAiFixture,dailyLimit:20}});
let stopping=false;async function stop(){if(stopping)return;stopping=true;await worker.stop();db.close();process.disconnect?.();}
process.on('message',message=>{if(message==='stop')void stop();});process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('Fixture worker ready — no live provider');
