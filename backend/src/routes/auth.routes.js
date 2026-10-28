import { Router } from 'express';
import { verifyPassword, hashPassword, credentialStamp } from '../services/passwords.js';
import { requireAuth, safeUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
const dummyHash=hashPassword('dummy-password');
const regenerate=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
const save=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
export function authRoutes(db,cookieOptions,limits,mfa) {
 const router=Router();
 router.post('/login',limits.login,async(req,res)=>{
  const {email,password,mfaCode}=req.body || {};
  if(mfaCode!==undefined&&(typeof mfaCode!=='string'||mfaCode.length>128))throw new ApiError(400,'BAD_INPUT','Use an authenticator or recovery code as text');
  if(typeof email!=='string' || !email.trim() || email.length>254 || typeof password!=='string' || !password || password.length>256)
   throw new ApiError(400,'BAD_INPUT','Email and password are required');
  const user=db.kind==='postgres'?(await db.query('SELECT * FROM novaworks.users WHERE email=$1',[email.trim().toLowerCase()])).rows[0]:db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
  const valid=verifyPassword(password,user?.password_hash || dummyHash);
  if(!user || !valid) {await limits.loginFailed(req);throw new ApiError(401,'INVALID_CREDENTIALS','Invalid email or password');}
  let factor={enabled:false,epoch:'none'},proof=null;if(mfa){factor=await mfa.state(user.id);if(factor.enabled){if(!mfaCode)throw new ApiError(401,'MFA_REQUIRED','Enter your authenticator code or a single-use recovery code');try{proof=await mfa.prove(user.id,mfaCode);}catch(error){if(['MFA_INVALID','MFA_LIMITED'].includes(error.code))await limits.loginFailed(req);throw error;}}}
  await limits.loginSucceeded(req);await regenerate(req);req.session.userId=user.id;req.session.mfaEpoch=proof?.epoch||factor.epoch;req.session.mfaVerified=!!proof;req.session.primaryAuthenticatedAt=Date.now();if(proof)req.session.mfaVerifiedAt=Date.now();req.session.credentialStamp=credentialStamp(user.password_hash);await save(req);
  res.json(safeUser(user));
 });
 router.get('/me',requireAuth(db,mfa),(req,res)=>res.json(req.user));
 router.post('/logout',(req,res,next)=>{
  req.session.destroy(error=>{if(error)return next(error);res.clearCookie('novaworks.sid',cookieOptions);res.json({success:true});});
 });
 return router;
}
