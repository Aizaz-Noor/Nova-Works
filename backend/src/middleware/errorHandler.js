export class ApiError extends Error {
 constructor(status, code, message, issues) { super(message); Object.assign(this, {status, code, issues}); }
}
export function errorHandler(error, req, res, next) {
 if (res.headersSent) return next(error);
 const status = error instanceof ApiError ? error.status : error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
 const code = error instanceof ApiError ? error.code : status === 400 ? 'BAD_JSON' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
 const message = error instanceof ApiError ? error.message : status === 400 ? 'Request body must be valid JSON' : status === 413 ? 'Request body exceeds the size limit' : 'An internal error occurred';
 if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
 res.status(status).json({success:false,error:{code,message,...(error.issues ? {issues:error.issues} : {})}});
}
