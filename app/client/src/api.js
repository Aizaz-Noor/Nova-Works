export class ApiError extends Error {
  constructor(message, status, issues = []) { super(message); this.status = status; this.issues = issues; }
}
export async function request(path, { body, ...options } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'include', ...options, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach your workspace. Check your connection, then try again.', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message || (response.status >= 500 ? 'Your workspace is temporarily unavailable. Try again, or contact your administrator.' : 'The request could not be completed. Please try again.'), response.status, data?.error?.issues || []);
  if (!data) throw new ApiError('The server returned an unreadable response. Please try again.', response.status);
  return data;
}
