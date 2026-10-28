import { randomUUID } from 'node:crypto';
import { ApiError } from '../middleware/errorHandler.js';

// Persisted claims coordinate every API instance. Provider timeout is 90s; leases
// allow recovery after worker death without permitting an active worker to save late.
export const LEASE_MS = 120000;
export function initializeDrafts(db) {
 if(db.kind!=='postgres')db.exec(`CREATE TABLE IF NOT EXISTS ai_drafts (id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL, token TEXT, lease_until BIGINT NOT NULL DEFAULT 0, draft_json TEXT, issues_json TEXT, result_json TEXT)`);
}
const table=db=>db.kind==='postgres'?'novaworks.ai_drafts':'ai_drafts';
// Placeholder numbering is per call, including overlapping asynchronous requests.
async function rows(db,sql,args=[]) {
 if(db.kind==='postgres'){let n=0;return(await db.query(sql.replace(/\?/g,()=>`$${++n}`),args)).rows;}
 return db.prepare(sql).all(...args);
}
function decode(row){if(!row)return null;return {...row,draft:row.draft_json?JSON.parse(row.draft_json):null,issues:row.issues_json?JSON.parse(row.issues_json):[],result:row.result_json?JSON.parse(row.result_json):null};}
export async function getDraft(db,id){return decode((await rows(db,`SELECT * FROM ${table(db)} WHERE id=?`,[id]))[0]);}
export async function claimExtraction(db,hash,{now=Date.now(),leaseMs=LEASE_MS}={}) {
 const token=randomUUID(),id=randomUUID();
 const acquired=await rows(db,`INSERT INTO ${table(db)} (id,hash,status,token,lease_until) VALUES(?,?,'extracting',?,?) ON CONFLICT(hash) DO UPDATE SET status='extracting',token=excluded.token,lease_until=excluded.lease_until WHERE ${table(db)}.status='failed' OR (${table(db)}.status='extracting' AND ${table(db)}.lease_until<=?) RETURNING *`,[id,hash,token,now+leaseMs,now]);
 if(acquired.length)return {...decode(acquired[0]),owned:true};
 const existing=decode((await rows(db,`SELECT * FROM ${table(db)} WHERE hash=?`,[hash]))[0]);
 if(existing?.status==='extracting')throw new ApiError(409,'SUBMISSION_IN_PROGRESS','This transcript is already processing; wait and retry');
 return {...existing,owned:false};
}
export async function finishExtraction(db,id,token,draft,issues=[]) {
 const updated=await rows(db,`UPDATE ${table(db)} SET status='review',draft_json=?,issues_json=?,token=NULL,lease_until=0 WHERE id=? AND token=? AND status='extracting' AND lease_until>? RETURNING id`,[JSON.stringify(draft),JSON.stringify(issues),id,token,Date.now()]);
 if(!updated.length)throw new ApiError(409,'LEASE_EXPIRED','Extraction ownership expired; retry the transcript');
 return getDraft(db,id);
}
export async function failClaim(db,id,token) {await rows(db,`UPDATE ${table(db)} SET status='failed',token=NULL,lease_until=0 WHERE id=? AND token=? RETURNING id`,[id,token]);}
export async function claimApproval(db,id) {
 const token=randomUUID(),now=Date.now();
 const updated=await rows(db,`UPDATE ${table(db)} SET status='approving',token=?,lease_until=? WHERE id=? AND (status='review' OR (status='approving' AND lease_until<=?)) RETURNING *`,[token,now+LEASE_MS,id,now]);
 if(updated.length)return {...decode(updated[0]),owned:true};
 const draft=await getDraft(db,id);
 if(!draft)throw new ApiError(404,'NOT_FOUND','Draft not found');
 if(draft.status==='approved')return {...draft,owned:false};
 throw new ApiError(409,'SUBMISSION_IN_PROGRESS','Draft is already processing; wait and retry');
}
export async function completeApproval(db,id,token,result,draft) {
 await rows(db,`UPDATE ${table(db)} SET status='approved',result_json=?,draft_json=?,issues_json='[]',token=NULL,lease_until=0 WHERE id=? AND token=? RETURNING id`,[JSON.stringify(result),JSON.stringify(draft),id,token]);
}
export async function releaseApproval(db,id,token) {await rows(db,`UPDATE ${table(db)} SET status='review',token=NULL,lease_until=0 WHERE id=? AND token=? RETURNING id`,[id,token]);}
