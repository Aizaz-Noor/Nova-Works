import { Router } from 'express';
import { teamDirectory } from '../services/projectService.js';
export function teamRoutes(db) {
 const router=Router();router.get('/',(req,res)=>res.json({team:teamDirectory(db)}));return router;
}
