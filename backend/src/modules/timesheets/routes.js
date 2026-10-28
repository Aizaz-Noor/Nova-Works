import {createBillingRateService} from './billingRates.js';
import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {createTimesheetService} from './service.js';
export function timesheetRoutes(db){
 const router=Router(),service=createTimesheetService(db);
 const args=req=>{if(!req.user?.id)throw new ApiError(401,'UNAUTHENTICATED','Login required');if(!req.session.organizationId)throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');return[req.user.id,req.session.organizationId];};
 const rates=createBillingRateService(db);
 router.get('/billing-rates',async(req,res)=>res.json(await rates.list(...args(req),req.query)));
 router.post('/billing-rates',async(req,res)=>{const result=await rates.create(...args(req),req.body);res.status(result.replayed?200:201).json(result);});
 router.patch('/billing-rates/:id',async(req,res)=>res.json(await rates.update(...args(req),req.params.id,req.body)));
 router.get('/time-projects',async(req,res)=>res.json(await service.projects(...args(req),req.query)));
 router.get('/time-projects/:id/tasks',async(req,res)=>res.json(await service.tasks(...args(req),req.params.id,req.query)));
 router.get('/time-entries',async(req,res)=>res.json(await service.list(...args(req),req.query)));
 router.post('/time-entries',async(req,res)=>res.status(201).json(await service.create(...args(req),req.body)));
 router.get('/time-entries/:id',async(req,res)=>res.json(await service.entry(...args(req),req.params.id)));
 router.patch('/time-entries/:id',async(req,res)=>res.json(await service.update(...args(req),req.params.id,req.body)));
 for(const action of ['submit','void','review'])router.post(`/time-entries/:id/${action}`,async(req,res)=>res.json(await service[action](...args(req),req.params.id,req.body)));
 return router;
}
