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
export function createApp({db,extract=extractProjects,sessionSecret=process.env.SESSION_SECRET,frontendOrigin=process.env.FRONTEND_ORIGIN||'http://localhost:5173',production=process.env.NODE_ENV==='production',loginLimit=Number(process.env.LOGIN_ATTEMPT_LIMIT||10),aiDailyLimit=Number(process.env.AI_DAILY_LIMIT||20)}={}) {
 if(!db)throw new Error('Database is required');
 if(!sessionSecret||sessionSecret.length<32||sessionSecret.startsWith('replace-'))throw new Error('SESSION_SECRET must be configured with at least 32 characters');
 const origin=new URL(frontendOrigin).origin;
 if(origin!==frontendOrigin)throw new Error('FRONTEND_ORIGIN must be an exact origin without a path or trailing slash');
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
 if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
 app.use((req,res,next)=>{
  const requestOrigin=req.headers.origin;
  if(requestOrigin&&requestOrigin!==origin) return next(new ApiError(403,'ORIGIN_FORBIDDEN','Request origin is not allowed'));
  if(requestOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Credentials','true');}
  if(req.method==='OPTIONS') {
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');return res.sendStatus(204);
  }
  next();
 });
 app.use(express.json({limit:'256kb'}));
 const cookieOptions={httpOnly:true,sameSite:'lax',secure:production,path:'/'};
 app.use(session({name:'novaworks.sid',store:new SQLiteSessionStore(db),secret:sessionSecret,resave:false,saveUninitialized:false,cookie:{...cookieOptions,maxAge:8*60*60*1000}}));
 app.get('/api/health',(req,res)=>res.json({success:true}));
 app.use('/api/auth',authRoutes(db,cookieOptions,limits));
 app.use('/api',requireAuth(db));
 app.use('/api/team',teamRoutes(db));app.use('/api/projects',projectRoutes(db));app.use('/api/tasks',taskRoutes(db));
 app.use('/api/admin',aiRoutes(db,extract,limits));
 const clientDist=fileURLToPath(new URL('../../app/client/dist/',import.meta.url));
 if(existsSync(clientDist))app.use(express.static(clientDist));
 app.use((req,res,next)=>next(new ApiError(404,'NOT_FOUND','Route not found')));
 app.use(errorHandler);return app;
}
