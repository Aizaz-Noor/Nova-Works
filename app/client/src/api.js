export class ApiError extends Error {
  constructor(message, status, issues = []) { super(message); this.status = status; this.issues = issues; }
}
export async function request(path, { body, ...options } = {}) {
  const backendPath = path === '/transcripts' ? '/admin/create-from-transcript' : path === '/tasks/mine' ? '/tasks' : path;
  let response;
  try {
    response = await fetch(`/api${backendPath}`, { credentials: 'include', ...options, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach your workspace. Check your connection, then try again.', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message || (response.status >= 500 ? 'Your workspace is temporarily unavailable. Try again, or contact your administrator.' : 'The request could not be completed. Please try again.'), response.status, (data?.error?.issues || []).map(issue => ({ ...issue, field: issue.field || issue.path })));
  if (!data) throw new ApiError('The server returned an unreadable response. Please try again.', response.status);
  if (path === '/auth/login' || path === '/auth/me') return { user: data.user || data };
  if (path === '/team') return { users: data.users || data.team || [] };
  if (path.startsWith('/projects/') && !data.project) return { project: data, tasks: data.tasks || [] };
  return data;
}
