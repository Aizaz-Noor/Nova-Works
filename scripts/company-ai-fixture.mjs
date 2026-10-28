// Local verification only. Does not call any external provider.
import {ApiError} from '../backend/src/middleware/errorHandler.js';
export async function companyAiFixture(transcript,team){
 if(transcript.includes('[fail]'))throw new ApiError(503,'AI_PROVIDER_ERROR','Fixture failure');
 const id=team.find(m=>m.role==='OWNER').id;
 return {projects:[{name:'Proposed client delivery',clientName:'Fictional client',description:'Fixture scope for review only',managerId:id,deadline:'2026-12-30',tasks:[{title:'Implement agreed scope',description:'Fictional implementation task',assigneeId:id,deadline:'2026-12-20',estimatedHours:8}]}]};
}
