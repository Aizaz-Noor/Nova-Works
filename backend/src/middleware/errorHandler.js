export class ApiError extends Error {
 constructor(status, code, message, issues) { super(message); Object.assign(this, {status, code, issues}); }
}
export function errorHandler(error, req, res, next) {
 if (res.headersSent) return next(error);
 const badPath=error instanceof URIError&&error.status===400;
 const databaseTimeout=error.code==='57014'||error.message==='Query read timeout';
 const status = error instanceof ApiError ? error.status : databaseTimeout?503 : badPath||error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
 const code = error instanceof ApiError ? error.code : databaseTimeout?'DATABASE_TIMEOUT' : status === 400 ? (badPath?'BAD_PATH':'BAD_JSON') : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
 const message = error instanceof ApiError ? error.message : databaseTimeout?'Database operation timed out; please retry' : status === 400 ? (badPath?'Request path contains invalid encoding':'Request body must be valid JSON') : status === 413 ? 'Request body exceeds the size limit' : 'An internal error occurred';
 if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
 res.status(status).json({success:false,error:{code,message,...(error.issues ? {issues:error.issues} : {})}});
}
