import {createMemberAdministration} from './memberAdministration.js';
import {attachmentRoutes} from '../modules/projects/attachmentRoutes.js';
import {createNotificationService} from './notifications.js';
import {createMilestoneService} from '../modules/projects/milestoneService.js';
import {createCommentService} from '../modules/projects/commentService.js';
import {requireRecentAuthentication} from './mfa/stepUp.js';
import {createSettingsService} from './settings.js';
import {billingRoutes} from './billing/routes.js';
import {reportRoutes} from '../modules/reports/routes.js';
import {companyAiRoutes} from '../modules/companyAi/routes.js';
import {invoiceRoutes} from '../modules/invoicing/routes.js';
import {timesheetRoutes} from '../modules/timesheets/routes.js';
import {salesRoutes} from '../modules/sales/routes.js';
import { Router } from 'express';
import { ApiError } from '../middleware/errorHandler.js';
import { createPlatformService } from './service.js';
import { createTaskService } from '../modules/projects/taskService.js';
import { crmRoutes } from '../modules/crm/routes.js';
import { pipelineRoutes } from '../modules/pipeline/routes.js';
import {requireExpectedCompanyContext} from './companyContext.js';

// Mount /api/v1 behind existing session, origin/CSRF and auth middleware. Register
// separately before auth; parent supplies login limiter and session regeneration.
export function platformRoutes(db,companyAiOptions,billingProvider,attachmentOptions) {
 const router=Router(); const service=createPlatformService(db);const tasks=createTaskService(db);
 router.use((req,res,next)=>req.user?.id ? next() : next(new ApiError(401,'UNAUTHENTICATED','Login required')));
 router.use(requireExpectedCompanyContext);
 router.use(companyAiRoutes(db,companyAiOptions));
 router.use(reportRoutes(db));
 router.use(billingRoutes(db,billingProvider));
 router.use('/customers',crmRoutes(db));
 router.use(pipelineRoutes(db));
 router.use(salesRoutes(db));
 router.use(timesheetRoutes(db));
 router.use(invoiceRoutes(db));
 router.use(attachmentRoutes(db,attachmentOptions));
 const user=req=>req.user.id;
 const organization=req=>req.session.organizationId || (()=>{throw new ApiError(409,'ORGANIZATION_REQUIRED','Select an organization first');})();
 const notifications=createNotificationService(db);
 router.get('/notifications',async(req,res)=>res.json(await notifications.list(user(req),organization(req),req.query)));
 router.post('/notifications/:id/read',async(req,res)=>{if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).length)throw new ApiError(400,'BAD_INPUT','Use an empty object to mark a notification read');res.json(await notifications.read(user(req),organization(req),req.params.id));});
 const milestones=createMilestoneService(db);
 router.get('/projects/:id/milestones',async(req,res)=>res.json(await milestones.list(user(req),organization(req),req.params.id,req.query)));
 router.get('/projects/:id/milestones/:milestoneId',async(req,res)=>res.json(await milestones.get(user(req),organization(req),req.params.id,req.params.milestoneId)));
 router.post('/projects/:id/milestones',async(req,res)=>{const result=await milestones.create(user(req),organization(req),req.params.id,req.body);res.status(result.replayed?200:201).json(result);});
 router.patch('/projects/:id/milestones/:milestoneId',async(req,res)=>res.json(await milestones.update(user(req),organization(req),req.params.id,req.params.milestoneId,req.body)));
 const comments=createCommentService(db);
 router.get('/tasks/:id/comments',async(req,res)=>res.json(await comments.list(user(req),organization(req),req.params.id,req.query)));
 router.post('/tasks/:id/comments',async(req,res)=>{const result=await comments.create(user(req),organization(req),req.params.id,req.body);res.status(result.replayed?200:201).json(result);});
 const settings=createSettingsService(db);
 router.get('/settings',async(req,res)=>res.json(await settings.get(user(req),organization(req))));
 router.patch('/settings',requireRecentAuthentication,async(req,res)=>res.json(await settings.update(user(req),organization(req),req.body)));
 router.get('/context',async(req,res)=>res.json(await service.selectOrganization(user(req),organization(req))));
 router.get('/organizations',async(req,res)=>res.json(await service.listOrganizations(user(req))));
 router.post('/organizations',async(req,res)=>res.status(201).json(await service.createOrganization(user(req),req.body)));
 router.post('/organizations/select',async(req,res)=>{
  const selected=await service.selectOrganization(user(req),req.body?.organizationId);
  req.session.organizationId=selected.organizationId;
  await new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
  res.json(selected);
 });
 const memberAdministration=createMemberAdministration(db);
 router.get('/member-administration',async(req,res)=>res.json(await memberAdministration.list(user(req),organization(req),req.query)));
 router.post('/member-administration/:id/transition',requireRecentAuthentication,async(req,res)=>res.json(await memberAdministration.transition(user(req),organization(req),req.params.id,req.body)));
 router.get('/members',async(req,res)=>res.json(await service.listMembers(user(req),organization(req))));
 router.post('/invitations',requireRecentAuthentication,async(req,res)=>res.status(201).json(await service.invite(user(req),organization(req),req.body)));
 router.post('/invitations/accept',async(req,res)=>res.json(await service.acceptInvitation(user(req),req.body?.organizationId,req.body?.token)));
 router.get('/tasks',async(req,res)=>res.json(await tasks.list(user(req),organization(req),req.query)));
 router.post('/tasks',async(req,res)=>res.status(201).json(await tasks.create(user(req),organization(req),req.body)));
 router.patch('/tasks/:id',async(req,res)=>res.json(await tasks.update(user(req),organization(req),req.params.id,req.body)));
 router.get('/projects',async(req,res)=>res.json(await service.listProjects(user(req),organization(req))));
 router.post('/projects',async(req,res)=>res.status(201).json(await service.createProject(user(req),organization(req),req.body)));
 router.patch('/projects/:id',async(req,res)=>res.json(await service.updateProject(user(req),organization(req),req.params.id,req.body)));
 router.get('/projects/export',async(req,res)=>res.json(await service.exportProjects(user(req),organization(req))));
 router.get('/projects/:id',async(req,res)=>res.json(await service.getReference(user(req),organization(req),'projects',req.params.id)));
 router.get('/drafts/:id',async(req,res)=>res.json(await service.getReference(user(req),organization(req),'drafts',req.params.id)));
 router.get('/files/:id',async(req,res)=>{
  const file=await service.getReference(user(req),organization(req),'files',req.params.id);
  // Never expose storage credentials or raw storage keys; actual downloads need a
  // separately authorized storage adapter, not a public bucket URL.
  const {storage_key,...safe}=file; res.json(safe);
 });
 return router;
}
