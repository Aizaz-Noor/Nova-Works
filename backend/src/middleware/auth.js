import { ApiError } from './errorHandler.js';
export function safeUser(row) {
 return {id:row.id,name:row.name,email:row.email,role:row.role,specialization:row.specialization};
}
export function requireAuth(db) {
 return async (req,res,next) => {
  const row=req.session.userId && (db.kind==='postgres'?(await db.query('SELECT id,name,email,role,specialization FROM novaworks.users WHERE id=$1',[req.session.userId])).rows[0]:db.prepare('SELECT id,name,email,role,specialization FROM users WHERE id=?').get(req.session.userId));
  if (!row) return next(new ApiError(401,'UNAUTHENTICATED','Login required'));
  req.user = safeUser(row); next();
 };
}
export function requireAdmin(req,res,next) {
 if (req.user.role !== 'ADMIN') return next(new ApiError(403,'FORBIDDEN','Administrator access required'));
 next();
}
