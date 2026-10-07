import './config.js';
import express from 'express';
import session from 'express-session';
import { requireAuth } from './middleware/auth.js';
import { ApiError, errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/projects.routes.js';
import { taskRoutes } from './routes/tasks.routes.js';
import { teamRoutes } from './routes/team.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { extractProjects } from './services/aiService.js';
export function createApp({db,extract=extractProjects,sessionSecret=process.env.SESSION_SECRET,frontendOrigin=process.env.FRONTEND_ORIGIN||'http://localhost:5173',production=process.env.NODE_ENV==='production'}={}) {
 if(!db)throw new Error('Database is required');
 if(!sessionSecret||sessionSecret.length<32||sessionSecret.startsWith('replace-'))throw new Error('SESSION_SECRET must be configured with at least 32 characters');
 const origin=new URL(frontendOrigin).origin;
 if(origin!==frontendOrigin)throw new Error('FRONTEND_ORIGIN must be an exact origin without a path or trailing slash');
 const app=express();app.disable('x-powered-by');
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
 app.use(session({name:'novaworks.sid',secret:sessionSecret,resave:false,saveUninitialized:false,cookie:{...cookieOptions,maxAge:8*60*60*1000}}));
 app.get('/api/health',(req,res)=>res.json({success:true}));
 app.use('/api/auth',authRoutes(db,cookieOptions));
 app.use('/api',requireAuth(db));
 app.use('/api/team',teamRoutes(db));app.use('/api/projects',projectRoutes(db));app.use('/api/tasks',taskRoutes(db));
 app.use('/api/admin',aiRoutes(db,extract));
 app.use((req,res,next)=>next(new ApiError(404,'NOT_FOUND','Route not found')));
 app.use(errorHandler);return app;
}
