import React, { useEffect, useId, useRef, useState } from 'react';
import { useCompanyRequest, requestBinary } from './api.js';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = '.txt,.pdf,.png,.jpg,.jpeg,text/plain,application/pdf,image/png,image/jpeg';
const extensionAllowed = name => /\.(txt|pdf|png|jpe?g)$/i.test(name);
const safeName = name => String(name || 'attachment').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\]/g, '_').slice(0, 180).replace(/^\.+$/, '_') || 'attachment';
const bytesLabel = bytes => `${Number(bytes).toLocaleString()} bytes`;

function base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export default function TaskAttachments({ taskId, organizationId, readOnly = false, onExpired }) {
  // Remount the whole panel, including native file selection, at either scope boundary.
  return <AttachmentPanel key={`${organizationId}:${taskId}`} taskId={taskId} readOnly={readOnly} onExpired={onExpired} />;
}

function AttachmentPanel({ taskId, readOnly, onExpired }) {
 const request = useCompanyRequest();
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const id = useId();
  const input = useRef(null);
  const alive = useRef(true);
  const pending = useRef(null);
  const actionPending = useRef(false);
  const controllers = useRef(new Set());
  const urls = useRef(new Map());
  const expired = useRef(onExpired);
  const locked = useRef(readOnly);
  expired.current = onExpired;
  locked.current = readOnly;
  const path = `/v1/tasks/${encodeURIComponent(taskId)}/attachments`;
  const busy = uploading || downloading !== null;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current = null;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
      for (const [url, timer] of urls.current) { clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setAttachments([]);
    setPagination(null);
    request(`${path}?page=${page}&limit=20`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, result.pagination.totalPages);
        if (page > lastPage) { setPage(lastPage); return; }
        setAttachments(result.attachments);
        setPagination(result.pagination);
      })
      .catch(problem => {
        if (controller.signal.aborted) return;
        if (problem.status === 401) expired.current?.();
        setError(problem.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, path, page, revision]);

  function choose(event) {
    const selected = event.target.files?.[0] || null;
    setError('');
    setNotice('');
    if (selected && (!extensionAllowed(selected.name) || selected.size === 0 || selected.size > MAX_BYTES)) {
      setFile(null);
      event.target.value = '';
      setError('Choose a non-empty TXT, PDF, PNG or JPEG file, no larger than 2,097,152 bytes (2 MiB).');
      return;
    }
    setFile(selected);
  }

  async function upload(event) {
    event.preventDefault();
    if (actionPending.current || !file || locked.current) return;
    actionPending.current = true;
    setUploading(true);
    setError('');
    setNotice('');
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const contentBase64 = base64(await file.arrayBuffer());
      if (!alive.current || controller.signal.aborted) return;
      if (locked.current) throw new Error('Your company is now read-only.');
      // Exact content and name define a retry, even if the same file is reselected.
      if (!pending.current || pending.current.name !== file.name || pending.current.contentBase64 !== contentBase64) {
        pending.current = { requestId: crypto.randomUUID(), name: file.name, contentBase64 };
      }
      await request(path, { method: 'POST', body: pending.current, signal: controller.signal });
      if (!alive.current) return;
      pending.current = null;
      setFile(null);
      if (input.current) input.current.value = '';
      setNotice('Attachment saved. Refresh the list if it does not appear yet.');
      setPage(1);
      setRevision(value => value + 1);
    } catch (problem) {
      if (!alive.current || controller.signal.aborted) return;
      if (problem.status === 401) expired.current?.();
      setError(`${problem.message || 'The file could not be uploaded.'} Your selected file is kept here. Retry unchanged to check the same upload.`);
    } finally {
      controllers.current.delete(controller);
      actionPending.current = false;
      if (alive.current) setUploading(false);
    }
  }

  async function download(attachment) {
    if (actionPending.current) return;
    actionPending.current = true;
    setDownloading(attachment.id);
    setError('');
    setNotice('');
    const controller = new AbortController();
    controllers.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await requestBinary(`${path}/${encodeURIComponent(attachment.id)}/download`, {
        organizationId: request.organizationId, onContextChanged: request.onContextChanged, signal: controller.signal, cache: 'no-store', timeoutMs: 30000,
      });
      if (!alive.current || controller.signal.aborted) return;
      if (!response.ok) {
        let detail;
        try { detail = await response.json(); } catch { /* Preserve HTTP status for non-JSON errors. */ }
        if (response.status === 401 && alive.current) expired.current?.();
        throw new Error(detail?.error?.message || (response.status === 404 ? 'This attachment is no longer available. Refresh the list.' : 'The attachment could not be downloaded. Try again.'));
      }
      if (response.headers.get('content-type')?.includes('application/json')) {
        const detail = await response.json();
        throw new Error(detail?.error?.message || 'The server returned an error instead of a file. Try again.');
      }
      const blob = await response.blob();
      if (!alive.current || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const timer = setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 30000);
      urls.current.set(url, timer);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeName(attachment.name);
      document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); }
      setNotice('Download started. Check your browser downloads.');
    } catch (problem) {
      if (problem.status === 401 && alive.current) expired.current?.();
      if (alive.current) setError(problem.name === 'AbortError' ? 'The download took too long. Try again.' : problem.message || 'Cannot reach your workspace. Try again.');
    } finally {
      clearTimeout(timeout);
      controllers.current.delete(controller);
      actionPending.current = false;
      if (alive.current) setDownloading(null);
    }
  }

  return <details className="task-attachments" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Task attachments</summary>
    {open && <div className="task-attachment-content">
      <p className="muted" id={`${id}-help`}>Share supporting files with people who can access this task. TXT, PDF, PNG and JPEG; maximum 2 MiB (2,097,152 bytes) per file. Downloads require task access.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {notice && <p className="notice success" role="status">{notice}</p>}
      <div aria-busy={loading}>
        {loading ? <p role="status">Loading attachments…</p> : attachments.length ? <ul className="task-attachment-list">{attachments.map(attachment => <li key={attachment.id}>
          <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><strong>{safeName(attachment.name)}</strong><p className="muted">{attachment.mime_type} · {bytesLabel(attachment.size_bytes)} · <time dateTime={attachment.created_at}>{new Date(attachment.created_at).toLocaleString()}</time></p></div>
          <button type="button" className="secondary" disabled={busy} aria-label={`Download ${safeName(attachment.name)}`} onClick={() => download(attachment)}>{downloading === attachment.id ? 'Downloading…' : 'Download attachment'}</button>
        </li>)}</ul> : !error && <p>No attachments yet. Add a supporting document or image.</p>}
      </div>
      <div className="list-summary" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="secondary" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}>Refresh attachments</button>
        {pagination?.totalPages > 1 && <nav aria-label="Attachment pages" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><button type="button" className="secondary" disabled={loading || busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous attachments</button><span>Page {page} of {pagination.totalPages}</span><button type="button" className="secondary" disabled={loading || busy || page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next attachments</button></nav>}
      </div>
      {readOnly ? <p className="muted">Your company is read-only. Saved attachments remain available to download.</p> : <form onSubmit={upload} aria-busy={uploading}>
        <label htmlFor={`${id}-file`}>Choose task attachment</label>
        <input ref={input} id={`${id}-file`} type="file" accept={ACCEPT} onChange={choose} disabled={busy} aria-describedby={`${id}-help`} style={{ maxWidth: '100%', minWidth: 0 }} />
        {file && <p className="muted" style={{ overflowWrap: 'anywhere' }}>Selected: {safeName(file.name)} · {bytesLabel(file.size)}</p>}
        <button type="submit" className="primary" disabled={busy || !file}>{uploading ? 'Uploading…' : 'Upload attachment'}</button>
      </form>}
    </div>}
  </details>;
}
