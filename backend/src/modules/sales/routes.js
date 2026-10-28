import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {createSalesService} from './service.js';
export function salesRoutes(db){
 const router=Router(),sales=createSalesService(db);
 const args=req=>{if(!req.user?.id)throw new ApiError(401,'UNAUTHENTICATED','Login required');if(!req.session.organizationId)throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');return [req.user.id,req.session.organizationId];};
 router.get('/quotes',async(req,res)=>res.json(await sales.quotes(...args(req),req.query)));
 router.post('/quotes',async(req,res)=>res.status(201).json(await sales.create(...args(req),req.body)));
 router.get('/quotes/:id',async(req,res)=>res.json(await sales.quote(...args(req),req.params.id)));
 router.patch('/quotes/:id',async(req,res)=>res.json(await sales.update(...args(req),req.params.id,req.body)));
 router.post('/quotes/:id/issue',async(req,res)=>res.json(await sales.issue(...args(req),req.params.id,req.body)));
 router.post('/quotes/:id/accept',async(req,res)=>res.json(await sales.decide(...args(req),req.params.id,req.body,true)));
 router.post('/quotes/:id/decline',async(req,res)=>res.json(await sales.decide(...args(req),req.params.id,req.body,false)));
 router.post('/quotes/:id/revise',async(req,res)=>res.json(await sales.revise(...args(req),req.params.id,req.body)));
 router.post('/quotes/:id/order',async(req,res)=>res.json(await sales.convert(...args(req),req.params.id,req.body)));
 router.get('/sales-orders',async(req,res)=>res.json(await sales.orders(...args(req),req.query)));
 router.get('/sales-orders/:id',async(req,res)=>res.json(await sales.order(...args(req),req.params.id)));
 return router;
}
