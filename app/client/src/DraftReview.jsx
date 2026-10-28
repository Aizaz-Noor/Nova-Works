import React, { useState } from 'react';
import { request } from './api.js';

export default function DraftReview({ result, transcript, onSaved, onDiscard }) {
  const [draft, setDraft] = useState(result.draft && Array.isArray(result.draft.projects) ? result.draft : {projects:[]});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  function update(projectIndex, taskIndex, field, value) {
    setDraft(current => ({ ...current, projects: current.projects.map((project, i) => i !== projectIndex ? project : taskIndex === null
      ? { ...project, [field]: value }
      : { ...project, tasks: project.tasks.map((task, j) => j === taskIndex ? { ...task, [field]: value } : task) }) }));
  }
  async function approve(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try { onSaved(await request(`/admin/ai-drafts/${encodeURIComponent(result.draftId)}/approve`, { method: 'POST', body: { draft } })); }
    catch (failure) { setError(failure); }
    finally { setBusy(false); }
  }
  return <section className="transcript-panel" aria-label="Review extracted work">
    <h2>Review before saving</h2><p>AI can misunderstand a meeting. Check the scope, people, dates and effort against the transcript. Projects and tasks are saved only after approval.</p>
    {transcript&&<details><summary>Compare with the original meeting</summary><pre className="source-transcript">{transcript}</pre></details>}
    {error && <div role="alert" className="notice error">{error.message}<ul>{error.issues?.map((issue, index) => <li key={index}>{issue.field || issue.path}: {issue.message}</li>)}</ul></div>}
    {result.issues?.length > 0 && <p className="notice">Some fields need correction. Check each value before approving.</p>}
    <form onSubmit={approve} aria-busy={busy}><fieldset disabled={busy} className="draft-fields">
      {draft.projects?.map((project, i) => <details key={i} open={i===0}><summary>{project.name || `Project ${i + 1}`} · {project.tasks?.length || 0} tasks</summary><fieldset><legend>Project {i + 1}</legend>
        {['name', 'clientName', 'description', 'managerId', 'deadline'].map(field => <label key={field}>{({name:'Project name',clientName:'Client',description:'Scope',managerId:'Manager ID',deadline:'Project deadline'})[field]}<input type={field === 'deadline' ? 'date' : 'text'} value={project[field] ?? ''} required={field !== 'description'} onChange={e => update(i, null, field, e.target.value)}/></label>)}
        {project.tasks?.map((task, j) => <details key={j}><summary>{task.title || `Task ${j + 1}`} · {task.assigneeId || 'Owner needed'} · {task.deadline || 'Date needed'} · {task.estimatedHours ?? '?'} hours</summary><fieldset><legend>Task {j + 1}</legend>{['title','description','assigneeId','deadline','estimatedHours'].map(field => <label key={field}>{({title:'Task title',description:'Task scope',assigneeId:'Assignee ID',deadline:'Task deadline',estimatedHours:'Estimated hours'})[field]}<input type={field === 'deadline' ? 'date' : field === 'estimatedHours' ? 'number' : 'text'} min={field === 'estimatedHours' ? '0.01' : undefined} step={field === 'estimatedHours' ? 'any' : undefined} required value={task[field] ?? ''} onChange={e => update(i, j, field, field === 'estimatedHours' ? Number(e.target.value) : e.target.value)}/></label>)}</fieldset></details>)}
      </fieldset></details>)}
      <div className="composer-footer"><button type="button" className="secondary" onClick={onDiscard}>Return to transcript</button><button className="primary" disabled={!draft.projects?.length}>{busy ? 'Saving approved work…' : 'Approve and save'}</button></div>
    </fieldset></form>
  </section>;
}
