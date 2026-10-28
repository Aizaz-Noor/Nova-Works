import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {createCompanyAiService} from './service.js';
export function companyAiRoutes(db,options){
 const router=Router(),service=createCompanyAiService(db,options);
 const org=req=>req.session.organizationId||(()=>{throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');})();
 router.get('/ai/jobs',async(req,res)=>res.json(await service.list(req.user.id,org(req),req.query)));
 router.post('/ai/jobs',async(req,res)=>res.status(201).json(await service.enqueue(req.user.id,org(req),req.body)));
 router.get('/ai/jobs/:id',async(req,res)=>res.json(await service.get(req.user.id,org(req),req.params.id)));
 router.post('/ai/jobs/:id/run',async(req,res)=>res.json(await service.run(req.user.id,org(req),req.params.id)));
 router.post('/ai/jobs/:id/approve',async(req,res)=>res.json(await service.approve(req.user.id,org(req),req.params.id,req.body)));
 router.post('/ai/jobs/:id/discard',async(req,res)=>res.json(await service.discard(req.user.id,org(req),req.params.id,req.body)));
 router.post('/ai/jobs/:id/redact',async(req,res)=>res.json(await service.redact(req.user.id,org(req),req.params.id,req.body)));
 return router;
}
