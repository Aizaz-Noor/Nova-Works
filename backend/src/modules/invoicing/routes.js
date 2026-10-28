import {createTimeBillingService} from './timeBillingService.js';
import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {createInvoiceService} from './service.js';
import {invoicePdf} from './pdf.js';
export function invoiceRoutes(db){
 const router=Router(),service=createInvoiceService(db);
 const args=req=>{if(!req.user?.id)throw new ApiError(401,'UNAUTHENTICATED','Login required');if(!req.session.organizationId)throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');return[req.user.id,req.session.organizationId];};
 const time=createTimeBillingService(db);
 router.get('/time-billing/eligible',async(req,res)=>res.json(await time.eligible(...args(req),req.query)));
 router.post('/time-billing/preview',async(req,res)=>res.json(await time.preview(...args(req),req.body)));
 router.post('/client-invoices/from-time',async(req,res)=>{const result=await time.create(...args(req),req.body);res.status(result.replayed?200:201).json(result);});
 router.get('/client-invoices',async(req,res)=>res.json(await service.list(...args(req),req.query)));
 router.post('/client-invoices',async(req,res)=>res.status(201).json(await service.create(...args(req),req.body)));
 router.get('/client-invoices/:id',async(req,res)=>res.json(await service.invoice(...args(req),req.params.id)));
 router.patch('/client-invoices/:id',async(req,res)=>res.json(await service.update(...args(req),req.params.id,req.body)));
 for(const action of ['issue','pay','credit','replacement'])router.post(`/client-invoices/:id/${action==='pay'?'payments':action}`,async(req,res)=>res.json(await service[action](...args(req),req.params.id,req.body)));
 router.post('/client-invoices/:id/payments/:paymentId/reverse',async(req,res)=>res.json(await service.reverse(...args(req),req.params.id,req.params.paymentId,req.body)));
 router.get('/client-invoices/:id/pdf',async(req,res)=>{const invoice=await service.invoice(...args(req),req.params.id),buffer=await invoicePdf(invoice);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${invoice.number}.pdf"`,'Cache-Control':'no-store'}).send(buffer);});
 router.get('/credit-notes/:id/pdf',async(req,res)=>{const{credit,invoice}=await service.creditDocument(...args(req),req.params.id),buffer=await invoicePdf(invoice,credit);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${credit.number}.pdf"`,'Cache-Control':'no-store'}).send(buffer);});
 return router;
}
