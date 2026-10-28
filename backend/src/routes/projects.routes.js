import {Router} from 'express';
import {getProject} from '../services/projectService.js';
import {paginatedList} from '../services/pagination.js';
export function projectRoutes(db){const router=Router();router.get('/',async(req,res)=>res.json(await paginatedList(db,req.user,'projects',req.query)));router.get('/:id',async(req,res)=>res.json(await getProject(db,req.user,req.params.id)));return router;}
