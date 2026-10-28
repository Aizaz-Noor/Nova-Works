import {requireRecentAuthentication} from '../mfa/stepUp.js';
import {Router} from 'express';
import {ApiError} from '../../middleware/errorHandler.js';
import {billingConfiguration} from './policy.js';
import {createBillingService} from './service.js';
import {verifyPaddleSignature,normalizePaddleEvent} from './paddle.js';
export function billingRoutes(db,providerOptions){
 const router=Router(),service=createBillingService(db,providerOptions),org=req=>req.session.organizationId||(()=>{throw new ApiError(409,'ORGANIZATION_REQUIRED','Select a company first');})();
 router.get('/billing/context',async(req,res)=>res.json(await service.context(req.user.id,org(req))));
 router.get('/billing/subscription',async(req,res)=>res.json(await service.details(req.user.id,org(req))));
 router.post('/billing/provision',requireRecentAuthentication,async(req,res)=>res.json(await service.operate(req.user.id,org(req),'PROVISION',req.body)));
 router.post('/billing/reconcile',requireRecentAuthentication,async(req,res)=>res.json(await service.operate(req.user.id,org(req),'RECONCILE',req.body)));
 router.post('/billing/replace',requireRecentAuthentication,async(req,res)=>res.json(await service.operate(req.user.id,org(req),'REPLACE',req.body)));
 return router;
}
export function paddleWebhook(db,secret){const service=createBillingService(db);return async(req,res)=>{
 const config=billingConfiguration(db);if(!config.enabled)throw new ApiError(503,'BILLING_DISABLED','Subscription processing is disabled');
 verifyPaddleSignature(req.body,req.headers['paddle-signature'],secret,{clock:config.clock});
 let payload;try{payload=JSON.parse(req.body.toString('utf8'));}catch{throw new ApiError(400,'BAD_JSON','Webhook body must be valid JSON');}
 const event=normalizePaddleEvent(payload,config.policy,{clock:config.clock});res.json(await service.apply(event));
};}
