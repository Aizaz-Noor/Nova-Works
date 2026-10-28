import {Router} from 'express';
import {paginatedList} from '../services/pagination.js';
export function taskRoutes(db){const router=Router();router.get('/',async(req,res)=>res.json(await paginatedList(db,req.user,'tasks',req.query)));return router;}
