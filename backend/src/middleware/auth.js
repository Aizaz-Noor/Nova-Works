import {credentialStamp} from '../services/passwords.js';
import { ApiError } from './errorHandler.js';
export function safeUser(row) {
 return {id:row.id,name:row.name,email:row.email,role:row.role,specialization:row.specialization};
}
export function requireAuth(db,mfa) {
 return async (req,res,next) => {
  const row=req.session.userId && (db.kind==='postgres'?(await db.query('SELECT id,name,email,role,specialization,password_hash FROM novaworks.users WHERE id=$1',[req.session.userId])).rows[0]:db.prepare('SELECT id,name,email,role,specialization,password_hash FROM users WHERE id=?').get(req.session.userId));
  if (!row || req.session.credentialStamp!==credentialStamp(row.password_hash)) return next(new ApiError(401,'UNAUTHENTICATED','Login required'));
  if(mfa){const state=await mfa.state(row.id);if(state.enabled&&!mfa.available())return next(new ApiError(503,'MFA_UNAVAILABLE','Authenticator encryption is not configured'));if((req.session.mfaEpoch||'none')!==state.epoch||state.enabled&&req.session.mfaVerified!==true)return next(new ApiError(401,'MFA_REQUIRED','Sign in again with your authenticator'));req.auth={mfaEnabled:state.enabled,mfaEpoch:state.epoch,mfaVerified:req.session.mfaVerified===true};}
  req.user = safeUser(row); next();
 };
}
export function requireAdmin(req,res,next) {
 if (req.user.role !== 'ADMIN') return next(new ApiError(403,'FORBIDDEN','Administrator access required'));
 next();
}
