import React, { createContext, useContext, useMemo } from 'react';

const companyRequestContext = createContext(null);

export const isCompanyContextChanged = error => error?.code === 'COMPANY_CONTEXT_CHANGED';

export class ApiError extends Error {
  constructor(message, status, issues = [], code) { super(message); this.status = status; this.issues = issues; this.code = code; }
}

export function createCompanyRequest(organizationId, onContextChanged) {
  if (typeof organizationId !== 'string' || !organizationId) throw new TypeError('A selected company is required for company requests.');
  const scopedRequest = (path, options = {}) => request(path, { ...options, organizationId, onContextChanged });
  Object.defineProperties(scopedRequest, { organizationId: { value: organizationId }, onContextChanged: { value: onContextChanged } });
  return scopedRequest;
}

export function CompanyRequestProvider({ organizationId, onContextChanged, children }) {
  const scopedRequest = useMemo(() => organizationId ? createCompanyRequest(organizationId, onContextChanged) : null, [organizationId, onContextChanged]);
  return React.createElement(companyRequestContext.Provider, { value: scopedRequest }, children);
}

export function useCompanyRequest() {
  const scopedRequest = useContext(companyRequestContext);
  if (!scopedRequest) throw new Error('Company request used outside a selected company workspace.');
  return scopedRequest;
}

export function useCompanyOrganizationId() {
  const scopedRequest = useCompanyRequest();
  return scopedRequest.organizationId;
}

export function companyHeaders(organizationId, headers) {
  const merged = new Headers(headers || {});
  if (organizationId) merged.set('X-NovaWorks-Organization', organizationId);
  return merged;
}

export async function requestBinary(path, { organizationId, onContextChanged, headers, signal, timeoutMs = 30000, ...options } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    let response;
    try {
      response = await fetch(`/api${path}`, { credentials: 'include', ...options, headers: companyHeaders(organizationId, headers), signal: controller.signal });
    } catch (error) {
      if (error.name === 'AbortError' || timedOut) throw error;
      throw new ApiError('Cannot reach your workspace. Check your connection, then try again.', 0);
    }
    if (!response.ok) {
      let data; try { data = await response.clone().json(); } catch (error) { if (error.name === 'AbortError' || timedOut) throw error; data = null; }
      const problem = new ApiError(data?.error?.message || (response.status === 404 ? 'The requested file is no longer available.' : 'The download could not be completed. Please try again.'), response.status, [], data?.error?.code);
      if (problem.status === 401) problem.message = 'Your session has expired. Sign in again to continue.';
      if (problem.code === 'COMPANY_CONTEXT_CHANGED') onContextChanged?.(problem);
      throw problem;
    }
    return response;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function request(path, { body, signal, timeoutMs, organizationId, onContextChanged, ...options } = {}) {
  const backendPath = path === '/transcripts' ? '/admin/create-from-transcript' : path === '/tasks/mine' ? '/tasks' : path;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs ?? (path === '/transcripts' ? 120000 : 15000));
  try {
    let response;
    try {
      response = await fetch(`/api${backendPath}`, {
        credentials: 'include', ...options, signal: controller.signal,
        headers: (() => { const merged = companyHeaders(organizationId, options.headers); if (body !== undefined && !merged.has('Content-Type')) merged.set('Content-Type', 'application/json'); return merged; })(),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
    } catch (error) {
      if (error.name === 'AbortError' || timedOut) throw error;
      throw new ApiError('Cannot reach your workspace. Check your connection, then try again.', 0);
    }
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (error.name === 'AbortError' || timedOut) throw error;
      data = null;
    }
    if (!response.ok) {
      const problem = new ApiError(data?.error?.message || (response.status >= 500 ? 'Your workspace is temporarily unavailable. Try again, or contact your administrator.' : 'The request could not be completed. Please try again.'), response.status, (data?.error?.issues || []).map(issue => ({ ...issue, field: issue.field || issue.path })), data?.error?.code);
      if (problem.code === 'COMPANY_CONTEXT_CHANGED') onContextChanged?.(problem);
      throw problem;
    }
    if (!data) throw new ApiError('The server returned an unreadable response. Please try again.', response.status);
    if (path === '/auth/login' || path === '/auth/me') return { user: data.user || data };
    if (path === '/team') return { users: data.users || data.team || [] };
    if (path.startsWith('/projects/') && !data.project) return { project: data, tasks: data.tasks || [] };
    return data;
  } catch (error) {
    if (timedOut) throw new ApiError(path === '/transcripts'
      ? 'Processing took too long to respond. Saving may still complete. Retry the same meeting to check its saved result; identical meetings will not be saved twice.'
      : 'Your workspace took too long to respond. Check your connection, then try again.', 0);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
