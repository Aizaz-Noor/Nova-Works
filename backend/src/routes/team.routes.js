import {Router} from 'express';
import {paginatedList} from '../services/pagination.js';
export function teamRoutes(db){const router=Router();router.get('/',async(req,res)=>res.json(await paginatedList(db,req.user,'team',req.query)));return router;}
