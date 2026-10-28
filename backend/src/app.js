import {requireRecentAuthentication} from './platform/mfa/stepUp.js';
import {mfaRoutes} from './platform/mfa/routes.js';
import {createMfaService} from './platform/mfa/service.js';
import {mfaOptionsFromEnvironment} from './platform/mfa/config.js';
import {recordAccountSecurity,createAccountSecurityService} from './platform/accountSecurity.js';
import {recoveryRoutes} from './platform/recoveryRoutes.js';
import {credentialStamp,verifyPassword,hashPassword} from './services/passwords.js';
import {configureBilling,configureBillingEnvironment,billingConfiguration} from './platform/billing/policy.js';
import {paddleWebhook} from './platform/billing/routes.js';
import {PostgresSessionStore} from './services/postgresSessionStore.js';
import './config.js';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import { requireAuth } from './middleware/auth.js';
import { ApiError, errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/projects.routes.js';
import { taskRoutes } from './routes/tasks.routes.js';
import { teamRoutes } from './routes/team.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { extractProjects } from './services/aiService.js';
import { SQLiteSessionStore } from './services/sessionStore.js';
import { createRequestLimits } from './services/requestLimits.js';
import { platformRoutes } from './platform/routes.js';
import { createPlatformService } from './platform/service.js';
import { requireLegacyDemo } from './platform/backfill.js';
import { registrationLimit } from './platform/registrationLimit.js';
import { isLoopbackSocket, validateLocalDemoActivation, localDemoDescriptor } from './localDemo.js';
export function createApp({db,attachmentOptions,mfaOptions,recoveryOptions,billingOptions,billingProvider,paddleWebhookSecret=process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET,companyAiFixture=false,companyAiOptions,localDemo=null,extract=extractProjects,sessionSecret=process.env.SESSION_SECRET,frontendOrigin=process.env.FRONTEND_ORIGIN||'http://localhost:5173',production=process.env.NODE_ENV==='production',loginLimit=Number(process.env.LOGIN_ATTEMPT_LIMIT||10),aiDailyLimit=Number(process.env.AI_DAILY_LIMIT||20),erpEnabled=process.env.ERP_ENABLED==='1'}={}) {
 if(!db)throw new Error('Database is required');
 const activeLocalDemo=validateLocalDemoActivation({localDemo,db,production,erpEnabled,enabled:process.env.LOCAL_DEMO_ENABLED==='1'});
 if(!sessionSecret||sessionSecret.length<32||sessionSecret.startsWith('replace-'))throw new Error('SESSION_SECRET must be configured with at least 32 characters');
 const mfa=createMfaService(db,{...(mfaOptions===undefined?mfaOptionsFromEnvironment():mfaOptions),allowMissingSchema:!erpEnabled});
 const origin=new URL(frontendOrigin).origin;
 if(origin!==frontendOrigin)throw new Error('FRONTEND_ORIGIN must be an exact origin without a path or trailing slash');
 const allowedOrigins=new Set([origin]);
 if(process.env.VERCEL){for(const key of ['VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL']){const host=process.env[key];if(host && /^[a-zA-Z0-9.-]+$/.test(host))allowedOrigins.add('https://'+host);}}
 if(erpEnabled){if(billingOptions)configureBilling(db,billingOptions);else configureBillingEnvironment(db);}
 if(production&&billingConfiguration(db).enabled&&billingConfiguration(db).policy.testOnly)throw new Error('Test billing policy cannot activate production');
 const app=express();app.disable('x-powered-by');
 const limits=createRequestLimits(db,{loginLimit,aiDailyLimit});
 app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
  if(production)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
 });
 // Set TRUST_PROXY=1 only when deployed behind one trusted reverse proxy.
 if(process.env.TRUST_PROXY==='1'&&!activeLocalDemo)app.set('trust proxy',1);
 app.use((req,res,next)=>{
  const requestOrigin=req.headers.origin;
  if(requestOrigin&&!allowedOrigins.has(requestOrigin)) return next(new ApiError(403,'ORIGIN_FORBIDDEN','Request origin is not allowed'));
  if(requestOrigin){res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Credentials','true');}
  if(req.method==='OPTIONS') {
   res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-NovaWorks-Organization');return res.sendStatus(204);
  }
  next();
 });
 if(erpEnabled)app.post('/api/billing/paddle-webhook',express.raw({type:'application/json',limit:'256kb'}),paddleWebhook(db,paddleWebhookSecret));
 // Only task-file uploads receive the larger JSON envelope; all existing routes retain 256KB.
 app.post(/^\/api\/v1\/tasks\/[a-f0-9-]{36}\/attachments$/i,express.json({limit:'3mb'}));
 app.use(express.json({limit:'256kb'}));
 const cookieOptions={httpOnly:true,sameSite:'lax',secure:production,path:'/'};
 app.use(session({name:'novaworks.sid',store:db.kind==='postgres'?new PostgresSessionStore(db):new SQLiteSessionStore(db),secret:sessionSecret,resave:false,saveUninitialized:false,cookie:{...cookieOptions,maxAge:8*60*60*1000}}));
 app.get('/api/capabilities',(req,res)=>res.json({erpEnabled,companyAiFixture:companyAiFixture===true,recoveryEnabled:typeof recoveryOptions?.deliver==='function',billingEnabled:billingConfiguration(db).enabled,localDemo:activeLocalDemo&&isLoopbackSocket(req.socket?.remoteAddress)?localDemoDescriptor:null}));
 if(erpEnabled){
  // Browser writes require the configured Origin, including signup and company selection.
  // JSON-only requests and Origin verification reject cross-site form submissions.
  app.use('/api/v1',(req,res,next)=>{
   if(!['GET','HEAD','OPTIONS'].includes(req.method)&&(!req.headers.origin||!allowedOrigins.has(req.headers.origin)))return next(new ApiError(403,'CSRF_REJECTED','A trusted browser origin is required'));
   if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.is('application/json'))return next(new ApiError(415,'JSON_REQUIRED','Use an application/json request'));
   next();
  });
  app.use('/api/v1',recoveryRoutes(db,recoveryOptions,cookieOptions));
  const platform=createPlatformService(db);
  app.post('/api/v1/register',registrationLimit(db),limits.login,async(req,res)=>{
   let user;
   try{user=await platform.register(req.body);}catch(error){await limits.loginFailed(req);throw error;}
   await new Promise((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
   req.session.userId=user.id;req.session.mfaEpoch='none';req.session.mfaVerified=false;req.session.primaryAuthenticatedAt=Date.now();
   const credential=db.kind==='postgres'?(await db.query('SELECT password_hash FROM novaworks.users WHERE id=$1',[user.id])).rows[0]:db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);req.session.credentialStamp=credentialStamp(credential.password_hash);
   await new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
   res.status(201).json(user);
  });
 }
 app.get('/api/health',async(req,res)=>{try{if(db.kind==='postgres')await db.query('SELECT 1');else db.prepare('SELECT 1').get();res.json({success:true});}catch{res.status(503).json({success:false,error:{code:'DATABASE_UNAVAILABLE',message:'Database is temporarily unavailable'}});}});
 app.use('/api/auth',authRoutes(db,cookieOptions,limits,mfa));
 app.use('/api',requireAuth(db,mfa));
 if(erpEnabled){
  app.get('/api/v1/context',async(req,res)=>{
   const platform=createPlatformService(db);const organizations=await platform.listOrganizations(req.user.id);
   const selected=organizations.find(item=>item.id===req.session.organizationId);
   res.json({organizationId:selected?.id||null,organizations});
  });
  app.get('/api/v1/account/security-events',async(req,res)=>{if(Object.keys(req.query).some(k=>k!=='page'))throw new ApiError(400,'BAD_INPUT','Only page is supported');res.json(await createAccountSecurityService(db).list(req.user.id,req.query));});
  app.post('/api/v1/account/password',requireRecentAuthentication,limits.login,async(req,res)=>{
   const body=req.body;if(!body||Object.keys(body).some(k=>!['currentPassword','newPassword'].includes(k))||typeof body.currentPassword!=='string'||!body.currentPassword||body.currentPassword.length>256||typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>128)throw new ApiError(400,'BAD_INPUT','Provide your current password and a new password of 12 to 128 characters');
   if(req.user.email.endsWith('@novaworks.example'))throw new ApiError(403,'DEMO_ACCOUNT','Demo account credentials cannot be changed here');
   const row=db.kind==='postgres'?(await db.query('SELECT password_hash FROM novaworks.users WHERE id=$1',[req.user.id])).rows[0]:db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
   if(!row||!verifyPassword(body.currentPassword,row.password_hash)){await limits.loginFailed(req);throw new ApiError(401,'INVALID_CREDENTIALS','Current password is incorrect');}
   if(body.currentPassword===body.newPassword)throw new ApiError(400,'BAD_INPUT','Choose a different new password');
   const next=hashPassword(body.newPassword);await createPlatformService(db).transaction(req.user.id,null,async c=>{const result=await c.query(`UPDATE ${db.kind==='postgres'?'novaworks.':''}users SET password_hash=? WHERE id=? AND password_hash=?`,[next,req.user.id,row.password_hash]);if((db.kind==='postgres'?result.rowCount:result.changes)!==1)throw new ApiError(409,'VERSION_CONFLICT','Credentials changed during this request. Sign in again.');await recordAccountSecurity(db,c,req.user.id,'PASSWORD_CHANGED');});
   await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));res.clearCookie('novaworks.sid',cookieOptions);res.json({success:true,signInRequired:true});
  });
  app.use('/api/v1',mfaRoutes(db,mfa));
  app.use('/api/v1',platformRoutes(db,companyAiOptions,billingProvider,attachmentOptions));
  app.use('/api',requireLegacyDemo(db));
 }
 app.use('/api/team',teamRoutes(db));app.use('/api/projects',projectRoutes(db));app.use('/api/tasks',taskRoutes(db));
 app.use('/api/admin',aiRoutes(db,extract,limits));
 const clientDist=fileURLToPath(new URL('../../app/client/dist/',import.meta.url));
 if(existsSync(clientDist))app.use(express.static(clientDist));
 app.use((req,res,next)=>next(new ApiError(404,'NOT_FOUND','Route not found')));
 app.use(errorHandler);return app;
}
