import { Router } from 'express';
import { listProjects, getProject } from '../services/projectService.js';
export function projectRoutes(db) {
 const router=Router();
 router.get('/',async(req,res)=>res.json({projects:await listProjects(db,req.user)}));
 router.get('/:id',async(req,res)=>res.json(await getProject(db,req.user,req.params.id)));
 return router;
}
