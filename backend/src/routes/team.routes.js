import { Router } from 'express';
import { teamDirectory } from '../services/projectService.js';
export function teamRoutes(db) {
 const router=Router();router.get('/',async(req,res)=>res.json({team:await teamDirectory(db)}));return router;
}
