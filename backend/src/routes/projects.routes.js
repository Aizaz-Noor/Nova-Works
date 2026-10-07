import { Router } from 'express';
import { listProjects, getProject } from '../services/projectService.js';
export function projectRoutes(db) {
 const router=Router();
 router.get('/',(req,res)=>res.json({projects:listProjects(db,req.user)}));
 router.get('/:id',(req,res)=>res.json(getProject(db,req.user,req.params.id)));
 return router;
}
