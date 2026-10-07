import { Router } from 'express';
import { listTasks } from '../services/projectService.js';
export function taskRoutes(db) {
 const router=Router();router.get('/',(req,res)=>res.json({tasks:listTasks(db,req.user)}));return router;
}
