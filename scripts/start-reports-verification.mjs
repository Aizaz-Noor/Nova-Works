import {openDatabase} from '../backend/src/db/database.js';
import {migratePlatform} from '../backend/src/platform/migrations.js';
import {createApp} from '../backend/src/app.js';
import {ApiError} from '../backend/src/middleware/errorHandler.js';
const db=openDatabase('data/reports-development.sqlite');await migratePlatform(db);
const disabled=async()=>{throw new ApiError(503,'AI_NOT_CONFIGURED','Provider calls are disabled in the reporting verification preview');};
createApp({db,erpEnabled:true,extract:disabled,companyAiOptions:{extract:disabled},sessionSecret:'reports-local-verification-secret-at-least-32',frontendOrigin:'http://127.0.0.1:3026',production:false}).listen(3026,'127.0.0.1',()=>console.log('Reporting verification preview http://127.0.0.1:3026 — fictional local data, provider disabled'));
