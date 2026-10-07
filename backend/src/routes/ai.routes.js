import { Router } from 'express';
import { createHash } from 'node:crypto';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { teamDirectory, previousSubmission, saveDraft } from '../services/projectService.js';
import { validateAiOutput } from '../validators/aiOutput.js';
export function aiRoutes(db,extract,limits) {
 const router=Router();const inFlight=new Set();
 router.post('/create-from-transcript',requireAdmin,async(req,res)=>{
  const transcript=req.body?.transcript;
  if(typeof transcript!=='string'||!transcript.trim()||transcript.length>100000)throw new ApiError(400,'BAD_INPUT','Transcript must contain 1 to 100000 characters');
  const normalized=transcript.trim();const hash=createHash('sha256').update(normalized).digest('hex');
  const prior=await previousSubmission(db,hash);
  if(prior)return res.json({...prior,replayed:true});
  if(inFlight.has(hash))throw new ApiError(409,'SUBMISSION_IN_PROGRESS','This transcript is already processing; wait and retry');
  inFlight.add(hash);
  try {
   await limits.ai();
   const directory=await teamDirectory(db);
   const draft=validateAiOutput(await extract(normalized,directory),directory);
   const result=await saveDraft(db,draft,hash);
   res.status(result.replayed?200:201).json(result);
  } finally {inFlight.delete(hash);}
 });
 return router;
}
