import React,{useEffect,useRef,useState} from 'react';
import { useCompanyRequest } from './api.js';
export default function TaskComments({task,members,onExpired,readOnly=false}){
 const [open,setOpen]=useState(false);
 return <details className="task-comments" onToggle={event=>{if(event.currentTarget.open)setOpen(true);}}><summary>Comments on {task.title}</summary>{open&&<Thread key={task.id} task={task} members={members} onExpired={onExpired} readOnly={readOnly}/>}</details>;
}
function Thread({task,members,onExpired,readOnly}){
 const request = useCompanyRequest();
 const [comments,setComments]=useState([]),[pagination,setPagination]=useState(null),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef(null),alive=useRef(true),textarea=useRef(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const path=`/v1/tasks/${encodeURIComponent(task.id)}/comments`;
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');request(`${path}?page=${page}&limit=25`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted){setComments(result.comments);setPagination(result.pagination);}}).catch(problem=>{if(controller.signal.aborted)return;if(problem.status===401)onExpired?.();setError(problem.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[path,page,revision]);
 async function submit(event){event.preventDefault();if(busy||readOnly||!body.trim())return;setBusy(true);setError('');setNotice('');
  if(!pending.current||pending.current.body!==body)pending.current={body,requestId:crypto.randomUUID()};
  try{await request(path,{method:'POST',body:pending.current});if(!alive.current)return;pending.current=null;setBody('');setNotice('Comment saved.');textarea.current?.focus();
   try{const first=await request(`${path}?page=1&limit=25`);if(!alive.current)return;setPage(Math.max(1,first.pagination.totalPages));setRevision(v=>v+1);}catch{if(alive.current){setNotice('Comment saved. Refresh the thread to read it.');setRevision(v=>v+1);}}
  }catch(problem){if(!alive.current)return;if(problem.status===401)onExpired?.();setError(`${problem.message} Your note is kept here. Retry unchanged to check the same saved comment.`);}finally{if(alive.current)setBusy(false);}
 }
 return <div className="task-comment-thread" aria-label={`Discussion for ${task.title}`}>
  <p className="muted" id={`comment-help-${task.id}`}>Notes for people with access to this task. Saved comments cannot currently be edited or removed. Unsent notes stay on this page only.</p>
  {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice success" role="status">{notice}</p>}
  <div aria-busy={loading}>{loading?<p role="status">Loading comments…</p>:comments.length?<ol className="task-comment-list">{comments.map(comment=><li key={comment.id}><p className="task-comment-meta"><strong>{members.find(m=>m.user_id===comment.author_id)?.name||'Company member'}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time></p><p className="task-comment-body">{comment.body}</p></li>)}</ol>:!error&&<p className="empty">No comments yet. Add a delivery note or question.</p>}</div>
  <div className="list-summary"><button type="button" className="secondary" disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>Refresh comments</button>{pagination?.totalPages>1&&<nav aria-label={`Comment pages for ${task.title}`}><button type="button" className="secondary" disabled={loading||busy||page<=1} onClick={()=>setPage(p=>p-1)}>Previous comments</button><span>Page {page} of {pagination.totalPages}</span><button type="button" className="secondary" disabled={loading||busy||page>=pagination.totalPages} onClick={()=>setPage(p=>p+1)}>Next comments</button></nav>}</div>
  {readOnly?<p className="muted">Your company is read-only. Saved comments remain available.</p>:<form onSubmit={submit}><label htmlFor={`comment-body-${task.id}`}>Add a comment</label><textarea ref={textarea} id={`comment-body-${task.id}`} value={body} onChange={event=>setBody(event.target.value)} maxLength={5000} required disabled={busy} aria-describedby={`comment-help-${task.id} comment-count-${task.id}`}/><div className="list-summary"><span className="muted" id={`comment-count-${task.id}`}>{body.length} / 5000 characters</span><button className="primary" disabled={busy||!body.trim()}>{busy?'Saving comment…':'Post comment'}</button></div></form>}
 </div>;
}
