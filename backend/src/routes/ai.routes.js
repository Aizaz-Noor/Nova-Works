import { Router } from 'express';
import { createHash } from 'node:crypto';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { teamDirectory, previousSubmission, saveDraft } from '../services/projectService.js';
import { validateAiOutput } from '../validators/aiOutput.js';
import { initializeDrafts, claimExtraction, finishExtraction, failClaim, getDraft, claimApproval, completeApproval, releaseApproval } from '../services/aiDrafts.js';
const view=d=>({draftId:d.id,status:d.status,draft:d.draft,issues:d.issues,...(d.result?{result:d.result}:{})});
export function aiRoutes(db,extract,limits) {
 const router=Router();initializeDrafts(db);
 async function extraction(transcript,strict=false) {
  if(typeof transcript!=='string'||!transcript.trim()||transcript.length>30000)throw new ApiError(400,'BAD_INPUT','Transcript must contain 1 to 30000 characters');
  const normalized=transcript.replace(/\r\n?/g,'\n').trim();const hash=createHash('sha256').update(normalized).digest('hex');
  const claim=await claimExtraction(db,hash);
  if(!claim.owned)return claim;
  try {
   await limits.ai();const directory=await teamDirectory(db);const raw=await extract(normalized,directory);
   let draft=raw,issues=[];
   try{draft=validateAiOutput(raw,directory);}catch(error){if(strict||error.code!=='INVALID_AI_OUTPUT')throw error;issues=error.issues||[];}
   return await finishExtraction(db,claim.id,claim.token,draft,issues);
  }catch(error){await failClaim(db,claim.id,claim.token);throw error;}
 }
 async function approve(id,edited) {
  const current=await getDraft(db,id);if(!current)throw new ApiError(404,'NOT_FOUND','Draft not found');
  if(current.status==='approved')return {...current.result,replayed:true};
  // Validate before taking the approval lease, so a bad correction remains editable.
  const validated=validateAiOutput(edited===undefined?current.draft:edited,await teamDirectory(db));
  const claim=await claimApproval(db,id);if(!claim.owned)return {...claim.result,replayed:true};
  try{const result=await saveDraft(db,validated,claim.hash);await completeApproval(db,id,claim.token,result,validated);return result;}
  catch(error){await releaseApproval(db,id,claim.token);throw error;}
 }
 router.post('/extract-transcript',requireAdmin,async(req,res)=>{const draft=await extraction(req.body?.transcript);res.status(200).json(view(draft));});
 router.get('/ai-drafts/:id',requireAdmin,async(req,res)=>{const draft=await getDraft(db,req.params.id);if(!draft)throw new ApiError(404,'NOT_FOUND','Draft not found');res.json(view(draft));});
 router.post('/ai-drafts/:id/approve',requireAdmin,async(req,res)=>{const result=await approve(req.params.id,req.body?.draft);res.status(result.replayed?200:201).json(result);});
 // Compatibility endpoint for the original hackathon demo. ERP UI uses review first.
 router.post('/create-from-transcript',requireAdmin,async(req,res)=>{
  const transcript=req.body?.transcript;
  if(typeof transcript!=='string'||!transcript.trim()||transcript.length>30000)throw new ApiError(400,'BAD_INPUT','Transcript must contain 1 to 30000 characters');
  const normalized=transcript.replace(/\r\n?/g,'\n').trim();
  for(const value of new Set([normalized,normalized.replace(/\n/g,'\r\n'),normalized.replace(/\n/g,'\r'),transcript.trim()])){const prior=await previousSubmission(db,createHash('sha256').update(value).digest('hex'));if(prior)return res.json({...prior,replayed:true});}
  const draft=await extraction(transcript,true);const result=await approve(draft.id);res.status(result.replayed?200:201).json(result);
 });
 return router;
}
