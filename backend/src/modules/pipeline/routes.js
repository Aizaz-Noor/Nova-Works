import { Router } from 'express';
import { ApiError } from '../../middleware/errorHandler.js';
import { createPipelineService } from './service.js';
export function pipelineRoutes(db){
 const router=Router(),service=createPipelineService(db);
 const args=req=>{if(!req.user?.id)throw new ApiError(401,'UNAUTHENTICATED','Login required');if(!req.session?.organizationId)throw new ApiError(409,'ORGANIZATION_REQUIRED','Select an organization first');return [req.user.id,req.session.organizationId];};
 router.get('/pipeline/stages',async(req,res)=>res.json(await service.stages(...args(req))));
 router.get('/leads',async(req,res)=>res.json(await service.leads(...args(req),req.query)));
 router.post('/leads',async(req,res)=>res.status(201).json(await service.createLead(...args(req),req.body)));
 router.get('/leads/:id',async(req,res)=>res.json(await service.lead(...args(req),req.params.id)));
 router.patch('/leads/:id',async(req,res)=>res.json(await service.updateLead(...args(req),req.params.id,req.body)));
 router.post('/leads/:id/convert',async(req,res)=>res.json(await service.convertLead(...args(req),req.params.id,req.body)));
 router.get('/deals',async(req,res)=>res.json(await service.deals(...args(req),req.query)));
 router.post('/deals',async(req,res)=>res.status(201).json(await service.createDeal(...args(req),req.body)));
 router.get('/deals/:id',async(req,res)=>res.json(await service.deal(...args(req),req.params.id)));
 router.patch('/deals/:id',async(req,res)=>res.json(await service.updateDeal(...args(req),req.params.id,req.body)));
 router.post('/deals/:id/project',async(req,res)=>res.json(await service.createProject(...args(req),req.params.id,req.body)));
 return router;
}
