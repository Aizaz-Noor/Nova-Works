import React, { useEffect, useRef, useState } from 'react';
import { request } from './api.js';
import { ProjectList, TaskList, DirectoryList } from './WorkLists.jsx';
const configuration = {
 projects: { label: 'projects', title: 'Find a project', hint: 'Project, client or manager', sorts: [['deadline','Deadline'],['name','Project name'],['clientName','Client'],['createdAt','Created date']] },
 tasks: { label: 'tasks', title: 'Find a task', hint: 'Task, scope or project', sorts: [['deadline','Deadline'],['title','Task title'],['estimatedHours','Estimated hours'],['createdAt','Created date']] },
 team: { label: 'people', title: 'Find a team member', hint: 'Name or specialization', sorts: [['name','Name'],['role','Role'],['specialization','Specialization'],['id','Employee ID']] }
};
export default function RemoteLists(props) {
 return <RemoteListContent key={props.kind + ':' + props.user.id} {...props} />;
}
function RemoteListContent({ kind, user, openProject, onExpired, version = 0 }) {
 const config = configuration[kind];
 const [input, setInput] = useState('');
 const [query, setQuery] = useState('');
 const [sort, setSort] = useState(kind === 'team' ? 'name' : 'deadline');
 const [order, setOrder] = useState('asc');
 const [role, setRole] = useState('');
 const [page, setPage] = useState(1);
 const [items, setItems] = useState([]);
 const [pagination, setPagination] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [reload, setReload] = useState(0);
 const latest = useRef(onExpired); latest.current = onExpired;
 useEffect(() => {
  const controller = new AbortController();
  setLoading(true); setError('');
  const params = new URLSearchParams({ page: String(page), limit: '25', q: query, sort, order });
  if (kind === 'team' && role) params.set('role', role);
  request(`/${kind}?${params}`, { signal: controller.signal }).then(result => {
   if (controller.signal.aborted) return;
   const next = result.pagination;
   if (next.totalPages > 0 && page > next.totalPages) { setPage(next.totalPages); return; }
   setItems(result[kind] || (kind === 'team' ? result.users : []) || []); setPagination(next);
  }).catch(problem => {
   if (controller.signal.aborted || problem.name === 'AbortError') return;
   if (problem.status === 401) latest.current?.();
   setError(problem.message || 'The list could not be loaded. Try again.');
  }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [kind, user.id, query, sort, order, role, page, version, reload]);
 function clear() { setInput(''); setQuery(''); setRole(''); setPage(1); }
 function search(event) { event.preventDefault(); setQuery(input.trim()); setPage(1); }
 const filtered = !!query || !!role;
 return <section aria-label={`${config.label} browser`} aria-busy={loading}>
  <form className="list-tools" onSubmit={search}>
   <div className="search-field"><label htmlFor={`remote-${kind}-search`}>{config.title}</label><input id={`remote-${kind}-search`} type="search" maxLength={200} placeholder={config.hint} value={input} onChange={event => setInput(event.target.value)} /></div>
   {kind === 'team' && <div className="select-field"><label htmlFor="remote-team-role">Role</label><select id="remote-team-role" value={role} onChange={event => { setRole(event.target.value); setPage(1); }}><option value="">All roles</option><option value="ADMIN">Administrator</option><option value="MANAGER">Project manager</option><option value="AGENT">Developer</option></select></div>}
   <div className="select-field"><label htmlFor={`remote-${kind}-sort`}>Sort by</label><select id={`remote-${kind}-sort`} value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>{config.sorts.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
   <div className="select-field"><label htmlFor={`remote-${kind}-order`}>Order</label><select id={`remote-${kind}-order`} value={order} onChange={event => { setOrder(event.target.value); setPage(1); }}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
   <button type="submit" className="primary">Search</button>
  </form>
  {error ? <div className="notice error" role="alert" style={{ marginTop: 16 }}><p>{error}</p><button className="secondary" type="button" onClick={() => setReload(value => value + 1)}>Retry loading</button></div> : loading ? <p className="loading" role="status">Loading {config.label}…</p> : <>
   <div className="list-summary"><p role="status">{pagination?.total || 0} {config.label}{filtered ? ' match your filters' : ' available'}</p>{filtered && <button type="button" className="text-button" onClick={clear}>Clear filters</button>}</div>
   {items.length ? kind === 'projects' ? <ProjectList projects={items} openProject={openProject} external /> : kind === 'tasks' ? <TaskList tasks={items} showProject openProject={openProject} external /> : <DirectoryList users={items} external /> : <div className="filter-empty"><h2>{filtered ? `No matching ${config.label}` : `No ${config.label} available`}</h2><p>{filtered ? 'Try another search or clear your filters.' : kind === 'tasks' ? 'Assigned work will appear here.' : kind === 'projects' ? 'Saved projects will appear here.' : 'Team members will appear here.'}</p>{filtered && <button className="secondary" type="button" onClick={clear}>Clear filters</button>}</div>}
   {pagination && pagination.total > 0 && <nav className="list-summary" aria-label={`${config.label} pages`} style={{ flexWrap: 'wrap' }}><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><p aria-live="polite">Page {pagination.page} of {pagination.totalPages} · {pagination.total} {config.label}</p><button type="button" className="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
  </>}
 </section>;
}
