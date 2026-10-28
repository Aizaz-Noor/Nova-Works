import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {createReportService} from './service.js';
export function reportRoutes(db){
 const router=Router(),service=createReportService(db);
 const org=req=>req.session.organizationId||(()=>{throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');})();
 router.get('/reports/:kind',async(req,res)=>res.json(await service.get(req.user.id,org(req),req.params.kind,req.query)));
 router.post('/reports/:kind/export',async(req,res)=>{const value=await service.get(req.user.id,org(req),req.params.kind,req.body,true);res.setHeader('Content-Disposition',`attachment; filename="novaworks-${value.kind}-report.json"`);res.json(value);});
 return router;
}
