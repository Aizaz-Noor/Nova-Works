import React, { useEffect, useId, useRef, useState } from 'react';
import { useCompanyRequest } from './api.js';

const roles = ['ADMIN', 'MANAGER', 'MEMBER'];
const label = value => value === 'ACTIVE' ? 'Active' : value === 'SUSPENDED' ? 'Suspended' : value.charAt(0) + value.slice(1).toLowerCase();

export default function CompanyMembers(props) {
  const { organization, user } = props;
  if (!organization?.id || !['OWNER', 'ADMIN'].includes(organization.role)) return null;
  return <MemberControls key={`${organization.id}:${user?.id}:${organization.role}`} {...props} />;
}

function MemberControls({ organization, user, onExpired, onMembersChanged }) {
 const request = useCompanyRequest();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(false);
  const mutationInFlight = useRef(false);
  const callbacks = useRef({ onExpired, onMembersChanged });
  callbacks.current = { onExpired, onMembersChanged };
  const heading = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setMembers([]);
    request(`/v1/member-administration?page=${page}&limit=20`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, result.pagination.totalPages);
      if (page > lastPage) { setPage(lastPage); return; }
      setMembers(result.members); setPagination(result.pagination);
      setDrafts(current => {
        const next = { ...current };
        for (const member of result.members) {
          if (!next[member.user_id]) next[member.user_id] = { role: member.role, status: member.status, version: member.version, confirmed: false, conflict: false };
        }
        return next;
      });
    }).catch(problem => {
      if (controller.signal.aborted) return;
      if (problem.status === 401) callbacks.current.onExpired?.();
      setError(problem.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, page, revision]);
  const busy = loading || Boolean(busyId);
  const permittedRoles = organization.role === 'OWNER' ? roles : roles.filter(role => role !== 'ADMIN');
  const editable = member => member.user_id !== user?.id && permittedRoles.includes(member.role);
  function change(id, patch) {
    setNotice('');
    setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  }
  async function save(event, member) {
    event.preventDefault();
    const draft = drafts[member.user_id];
    if (mutationInFlight.current || busy || !editable(member) || draft.conflict || !permittedRoles.includes(draft.role)) return;
    if (draft.status === 'SUSPENDED' && member.status !== 'SUSPENDED' && !draft.confirmed) return;
    mutationInFlight.current = true;
    setBusyId(member.user_id); setError(''); setNotice('');
    try {
      const result = await request(`/v1/member-administration/${encodeURIComponent(member.user_id)}/transition`, { method: 'POST', body: { version: draft.version, role: draft.role, status: draft.status } });
      if (!alive.current) return;
      const saved = { ...member, ...(result.member || result) };
      setMembers(current => current.map(row => row.user_id === saved.user_id ? saved : row));
      setDrafts(current => ({ ...current, [saved.user_id]: { role: saved.role, status: saved.status, version: saved.version, confirmed: false, conflict: false } }));
      setNotice(`Company membership saved for ${saved.name || saved.email}.`);
      callbacks.current.onMembersChanged?.();
    } catch (problem) {
      if (!alive.current) return;
      if (problem.status === 401) callbacks.current.onExpired?.();
      if (problem.status === 409) change(member.user_id, { conflict: true, confirmed: false });
      setError(problem.status === 409 ? 'This membership changed. Your proposed values are retained. Reload saved members, compare the saved values, then adopt the current version before saving.' : problem.message);
    } finally { mutationInFlight.current = false; if (alive.current) setBusyId(null); }
  }
  return <details className="transcript-panel" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary style={{ minHeight: 44, alignContent: 'center' }}><strong id={heading}>Company member controls</strong></summary>
    {open && <section aria-labelledby={heading} aria-busy={busy} style={{ minWidth: 0, marginTop: 12 }}>
      <p>Manage roles and company access for {organization.name}. Suspension applies only to this company and keeps existing records.</p>
      <button type="button" className="secondary" disabled={busy} onClick={() => { setNotice(''); setRevision(value => value + 1); }}>Reload saved members</button>
      {error && <p className="notice error" role="alert">{error}</p>}
      {notice && <p className="notice success" role="status">{notice}</p>}
      {loading ? <p role="status">Loading saved memberships…</p> : !error && !members.length ? <p>No company members found.</p> : null}
      {!loading && members.map(member => {
        const draft = drafts[member.user_id];
        const canEdit = editable(member);
        const changed = draft && (draft.role !== member.role || draft.status !== member.status);
        const stale = draft && draft.version !== member.version;
        return <article className="erp-member-row" key={member.user_id} style={{ borderTop: '1px solid #DCE3E9', marginTop: 16, paddingTop: 16, minWidth: 0, overflowWrap: 'anywhere' }}>
          <details className="erp-member-editor"><summary><strong>{member.name || member.email}</strong><span>{label(member.role)} · {label(member.status)}</span></summary>
          <h3>{member.name || member.email}</h3><p className="muted">{member.email}</p>
          <p>Saved: {label(member.role)} · {label(member.status)} · Version {member.version}</p>
          {!canEdit ? <p className="muted">{member.user_id === user?.id ? 'Your own membership cannot be changed here.' : member.role === 'OWNER' ? 'Owner membership is protected.' : 'Only the company owner can change administrator membership.'}</p> : draft && <form onSubmit={event => save(event, member)}>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
              <legend>Proposed changes for {member.name || member.email}</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, marginTop: 8 }}>
                <label>Company role<select style={{ minHeight: 44 }} value={draft.role} onChange={event => change(member.user_id, { role: event.target.value })}>{permittedRoles.map(role => <option key={role} value={role}>{label(role)}</option>)}</select></label>
                <label>Company access<select style={{ minHeight: 44 }} value={draft.status} onChange={event => change(member.user_id, { status: event.target.value, confirmed: false })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label>
              </div>
              {draft.status === 'SUSPENDED' && member.status !== 'SUSPENDED' && <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, marginTop: 8 }}><input type="checkbox" style={{ width: 20, height: 20, flexShrink: 0 }} checked={draft.confirmed} onChange={event => change(member.user_id, { confirmed: event.target.checked })} />Suspend company access only</label>}
              {(draft.conflict || stale) && <div className="notice"><p>Your proposal: {label(draft.role)} · {label(draft.status)}. Based on version {draft.version}. Saved values are shown above.</p><button type="button" className="secondary" disabled={!stale} onClick={() => change(member.user_id, { version: member.version, conflict: false, confirmed: false })}>Use saved version and keep proposed values</button>{!stale && <p>Reload saved members to obtain the current version.</p>}</div>}
              <button style={{ minHeight: 44, marginTop: 12 }} disabled={!changed || draft.conflict || stale || (draft.status === 'SUSPENDED' && member.status !== 'SUSPENDED' && !draft.confirmed)}>{busyId === member.user_id ? 'Saving member changes…' : 'Save member changes'}</button>
            </fieldset>
          </form>}
          </details>
        </article>;
      })}
      {pagination?.totalPages > 1 && <nav aria-label="Company member pages" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}><button type="button" className="secondary" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous members</button><span>Page {page} of {pagination.totalPages}</span><button type="button" className="secondary" disabled={busy || page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next members</button></nav>}
    </section>}
  </details>;
}
