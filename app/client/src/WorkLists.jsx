import React, { useState } from 'react';

const roleNames = { ADMIN: 'Administrator', MANAGER: 'Project manager', AGENT: 'Developer' };
const formatDate = value => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value.slice(0, 10) + 'T12:00:00')) : 'Not set';
const includes = (query, ...fields) => fields.some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase()));
const compareName = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
function NoResults({ noun, clear }) {
  return <div className="filter-empty"><h2>No matching {noun}</h2><p>Try a different search or clear your filters to see all available {noun}.</p><button type="button" className="secondary" onClick={clear}>Clear filters</button></div>;
}
function Summary({ shown, total, noun, filtered, clear }) {
  return <div className="list-summary"><p role="status">{shown} of {total} {noun} shown</p>{filtered && <button type="button" className="text-button" onClick={clear}>Clear filters</button>}</div>;
}
export function ProjectList({ projects, openProject }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('deadline');
  const clear = () => { setQuery(''); setSort('deadline'); };
  const visible = projects.filter(p => includes(query, p.name, p.clientName, p.managerName))
    .sort((a, b) => sort === 'name' ? compareName(a.name, b.name) : String(a.deadline || '').localeCompare(String(b.deadline || '')) || compareName(a.name, b.name));
  return <section aria-label="Project list">
    <div className="list-tools"><div className="search-field"><label htmlFor="project-search">Find a project</label><input id="project-search" type="search" placeholder="Project, client or manager" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="select-field"><label htmlFor="project-sort">Order projects</label><select id="project-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="deadline">Deadline · earliest first</option><option value="name">Project name · A–Z</option></select></div></div>
    <Summary shown={visible.length} total={projects.length} noun="projects" filtered={!!query || sort !== 'deadline'} clear={clear}/>
    {visible.length ? <div className="project-ledger"><div className="project-ledger-head" aria-hidden="true"><span>Project / client</span><span>Manager</span><span>Delivery</span><span></span></div>{visible.map(p => <button className="project-card" key={p.id} onClick={() => openProject(p.id)}>
      <div className="project-identity"><h2>{p.name}</h2><span className="client-name">{p.clientName}</span><p>{p.description || 'Open the project to review scope and assignments.'}</p></div>
      <div className="project-manager"><span className="mobile-label">Project manager</span>{p.managerName || p.managerId}</div>
      <div className="project-delivery"><span className="mobile-label">Delivery deadline</span><time dateTime={p.deadline}>{formatDate(p.deadline)}</time></div>
      <span className="open-project">Open <span aria-hidden="true">↗</span></span>
    </button>)}</div> : <NoResults noun="projects" clear={clear}/>}
  </section>;
}
export function TaskList({ tasks, showProject, openProject }) {
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sort, setSort] = useState('earliest');
  const clear = () => { setQuery(''); setAssignee(''); setSort('earliest'); };
  const owners = [...new Map(tasks.map(t => [String(t.assigneeId), { id: String(t.assigneeId), name: t.assigneeName || t.assigneeId }])).values()].sort((a, b) => compareName(a.name, b.name));
  const visible = tasks.filter(t => (!assignee || String(t.assigneeId) === assignee) && includes(query, t.title, t.description, t.projectName, t.assigneeName))
    .sort((a, b) => (sort === 'latest' ? -1 : 1) * String(a.deadline || '').localeCompare(String(b.deadline || '')) || compareName(a.title, b.title));
  return <section aria-label="Task list">
    <div className="list-tools"><div className="search-field"><label htmlFor="task-search">Find a task</label><input id="task-search" type="search" placeholder="Task, scope or project" value={query} onChange={e => setQuery(e.target.value)} /></div>
      {owners.length > 1 && <div className="select-field"><label htmlFor="task-assignee">Assigned to</label><select id="task-assignee" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">All available people</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></div>}
      <div className="select-field"><label htmlFor="task-sort">Order tasks</label><select id="task-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="earliest">Deadline · earliest first</option><option value="latest">Deadline · latest first</option></select></div>
    </div><Summary shown={visible.length} total={tasks.length} noun="tasks" filtered={!!query || !!assignee || sort !== 'earliest'} clear={clear}/>
    {visible.length ? <div className="task-table"><div className="task-head" aria-hidden="true"><span>Task & scope</span><span>Assigned to</span><span>Deadline</span><span>Effort</span></div>{visible.map(t => <article className="task-row" key={t.id}><div className="task-content">{showProject && <button className="project-link" onClick={() => openProject(t.projectId)}>{t.projectName || 'Open project'}</button>}<h3>{t.title}</h3><p>{t.description || 'No description provided.'}</p></div><div className="task-owner"><span className="mobile-label">Assigned to</span>{t.assigneeName || t.assigneeId}</div><div><span className="mobile-label">Deadline</span><time dateTime={t.deadline}>{formatDate(t.deadline)}</time></div><div className="hours"><span className="mobile-label">Effort</span>{t.estimatedHours} <span>hours</span></div></article>)}</div> : <NoResults noun="tasks" clear={clear}/>}
  </section>;
}
export function DirectoryList({ users }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const clear = () => { setQuery(''); setRole(''); };
  const visible = users.filter(u => (!role || u.role === role) && includes(query, u.name, u.specialization, ...(u.skills || [])));
  return <section aria-label="Team directory">
    <div className="list-tools"><div className="search-field"><label htmlFor="team-search">Find a team member</label><input id="team-search" type="search" placeholder="Name, specialization or skill" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="select-field"><label htmlFor="team-role">Role</label><select id="team-role" value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{Object.entries(roleNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
    <Summary shown={visible.length} total={users.length} noun="people" filtered={!!query || !!role} clear={clear}/>
    {visible.length ? <div className="directory"><div className="directory-head"><span>Team member</span><span>Specialization</span></div>{visible.map(u => <div className="directory-row" key={u.id}><div className="person"><span className="initials" aria-hidden="true">{u.name.split(' ').slice(0, 2).map(n => n[0]).join('')}</span><div><strong>{u.name}</strong><span>{roleNames[u.role] || u.role}</span></div></div><span>{u.specialization || 'Not specified'}</span></div>)}</div> : <NoResults noun="people" clear={clear}/>}
  </section>;
}