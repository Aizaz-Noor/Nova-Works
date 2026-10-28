import React, { useEffect, useId, useRef, useState } from 'react';
import { useCompanyRequest } from './api.js';
import './notifications.css';

export default function Notifications({ organization, onExpired }) {
  const companyId = organization?.id || organization?.organization_id;
  return companyId ? <NotificationInbox key={companyId} organization={organization} onExpired={onExpired} /> : null;
}

function NotificationInbox({ organization, onExpired }) {
 const request = useCompanyRequest();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const headingId = useId();
  const expiryCallback = useRef(onExpired);
  expiryCallback.current = onExpired;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    // Clear stale pages while fetching so withdrawn task access is not presented as current.
    setItems([]);
    request(`/v1/notifications?page=${page}&limit=20`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, result.pagination.totalPages);
        if (page > lastPage) { setPage(lastPage); return; }
        setItems(result.notifications);
        setPagination(result.pagination);
        setUnread(result.unread);
      })
      .catch(problem => {
        if (controller.signal.aborted) return;
        if (problem.status === 401) expiryCallback.current?.();
        setError(problem.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, page, revision]);

  async function acknowledge(item) {
    if (busyId || loading || item.read_at) return;
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const result = await request(`/v1/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST', body: {} });
      if (!alive.current) return;
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, read_at: result.read_at } : entry));
      // Reconcile counts with the server: a second tab may already have acknowledged this item.
      setNotice('Notification marked as read.');
      setRevision(value => value + 1);
    } catch (problem) {
      if (!alive.current) return;
      if (problem.status === 401) expiryCallback.current?.();
      setError(problem.status === 404 ? 'This notification is no longer available. Refresh to update the list.' : problem.message);
    } finally { if (alive.current) setBusyId(null); }
  }

  const busy = loading || Boolean(busyId);
  return <section className="nw-notifications" aria-labelledby={headingId}>
    <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary><span id={headingId}>Notifications</span>{unread !== null && <span className="nw-notifications-count">{unread} unread</span>}</summary>
      {open && <div className="nw-notifications-content">
        <div className="nw-notifications-toolbar"><p>Task comment updates for {organization.name || 'this company'}.</p><button type="button" className="secondary" disabled={busy} onClick={() => { setNotice(''); setRevision(value => value + 1); }}>Refresh notifications</button></div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {notice && <p className="notice success" role="status">{notice}</p>}
        <div aria-busy={loading}>
          {loading ? <p role="status">Loading notifications…</p> : items.length ? <ul className="nw-notifications-list">{items.map(item => <li key={item.id} className={item.read_at ? 'is-read' : 'is-unread'}>
            <div className="nw-notifications-message"><span className="nw-notifications-state">{item.read_at ? 'Read' : 'Unread'}</span><p><strong>New task comment</strong></p><p className="nw-notifications-task">{item.task_title}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>
            {!item.read_at && <button type="button" className="secondary" disabled={busy} aria-label={`Mark notification for ${item.task_title} as read`} onClick={() => acknowledge(item)}>{busyId === item.id ? 'Marking as read…' : 'Mark as read'}</button>}
          </li>)}</ul> : !error && <p className="nw-notifications-empty">No task comment notifications yet. Updates appear here when someone comments on work you can access.</p>}
        </div>
        {!loading && !error && pagination?.total > 0 && <p className="nw-notifications-caption">{pagination.total} notification{pagination.total === 1 ? '' : 's'} · {unread} unread. Open the task in Projects to read its discussion.</p>}
        {pagination?.totalPages > 1 && <nav className="nw-notifications-pages" aria-label="Notification pages"><button type="button" className="secondary" disabled={busy || page <= 1} onClick={() => { setNotice(''); setPage(value => value - 1); }}>Previous notifications</button><span>Page {page} of {pagination.totalPages}</span><button type="button" className="secondary" disabled={busy || page >= pagination.totalPages} onClick={() => { setNotice(''); setPage(value => value + 1); }}>Next notifications</button></nav>}
        <p className="nw-notifications-caption">Notifications update when opened or refreshed. Email delivery is not connected.</p>
      </div>}
    </details>
  </section>;
}
