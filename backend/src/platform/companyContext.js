import {ApiError} from '../middleware/errorHandler.js';

const HEADER='X-NovaWorks-Organization';
const MAX_ORGANIZATION_ID_LENGTH=200;
const BOOTSTRAP_PATHS=new Set(['/context','/organizations','/organizations/select','/invitations/accept']);

// This value is only a precondition. Tenant authority continues to come from
// the authenticated session and the existing membership checks in services.
export function requireExpectedCompanyContext(req,res,next){
 const supplied=req.get(HEADER);
 if(supplied===undefined||BOOTSTRAP_PATHS.has(req.path))return next();
 if(typeof supplied!=='string'||!supplied.length||supplied.length>MAX_ORGANIZATION_ID_LENGTH||supplied!==supplied.trim()||/[\u0000-\u001f\u007f]/.test(supplied)){
  return next(new ApiError(400,'BAD_ORGANIZATION_CONTEXT','Organization context header is invalid'));
 }
 const selected=req.session?.organizationId;
 if(selected&&supplied!==selected){
  return next(new ApiError(409,'COMPANY_CONTEXT_CHANGED','The selected company changed. Re-select the company shown in this tab before continuing.'));
 }
 next();
}
