import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {createAttachmentService} from './attachmentService.js';
export function attachmentRoutes(db,options={}){
 const router=Router(),service=createAttachmentService(db,options);
 const args=req=>{if(!req.session.organizationId)throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');return [req.user.id,req.session.organizationId,req.params.id];};
 router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 router.get('/tasks/:id/attachments',async(req,res)=>res.json(await service.list(...args(req),req.query)));
 router.post('/tasks/:id/attachments',async(req,res)=>{const result=await service.create(...args(req),req.body);res.status(result.replayed?200:201).json(result);});
 router.get('/tasks/:id/attachments/:attachmentId/download',async(req,res)=>{const file=await service.download(...args(req),req.params.attachmentId);res.set({'Content-Type':file.mimeType,'X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/[!'()*]/g,ch=>'%'+ch.charCodeAt(0).toString(16))}`,'Content-Length':String(file.bytes.length)}).send(file.bytes);});
 return router;
}
