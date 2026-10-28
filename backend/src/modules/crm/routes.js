import { Router } from 'express';
import { ApiError } from '../../middleware/errorHandler.js';
import { createCrmService } from './service.js';

export function crmRoutes(db){
 const router=Router(),service=createCrmService(db);
 const args=req=>{if(!req.user?.id)throw new ApiError(401,'UNAUTHENTICATED','Login required');if(!req.session?.organizationId)throw new ApiError(409,'ORGANIZATION_REQUIRED','Select an organization first');return [req.user.id,req.session.organizationId];};
 router.get('/',async(req,res)=>res.json(await service.list(...args(req),req.query)));
 router.post('/',async(req,res)=>res.status(201).json(await service.create(...args(req),req.body)));
 router.get('/:id',async(req,res)=>res.json(await service.get(...args(req),req.params.id)));
 router.patch('/:id',async(req,res)=>res.json(await service.update(...args(req),req.params.id,req.body)));
 router.get('/:id/projects',async(req,res)=>res.json(await service.projects(...args(req),req.params.id,req.query)));
 router.post('/:id/projects',async(req,res)=>res.json(await service.linkProject(...args(req),req.params.id,req.body)));
 router.get('/:id/contacts',async(req,res)=>res.json(await service.contacts(...args(req),req.params.id,req.query)));
 router.post('/:id/contacts',async(req,res)=>res.status(201).json(await service.addContact(...args(req),req.params.id,req.body)));
 router.get('/:id/activities',async(req,res)=>res.json(await service.activities(...args(req),req.params.id,req.query)));
 router.post('/:id/activities',async(req,res)=>res.status(201).json(await service.addActivity(...args(req),req.params.id,req.body)));
 return router;
}
