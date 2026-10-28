import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanyRequest, isCompanyContextChanged, requestBinary } from './api.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('company request stays bound to the captured company and merges headers', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, options) => { captured = options; return json({ ok: true }); };
  try {
    let selected = 'company-a';
    const requestA = createCompanyRequest(selected);
    selected = 'company-b';
    const requestB = createCompanyRequest(selected);
    await requestA('/v1/projects', { method: 'POST', body: { name: 'A draft' }, headers: { 'X-Client-Trace': 'trace-1' } });
    assert.equal(new Headers(captured.headers).get('X-NovaWorks-Organization'), 'company-a');
    assert.equal(new Headers(captured.headers).get('Content-Type'), 'application/json');
    assert.equal(new Headers(captured.headers).get('X-Client-Trace'), 'trace-1');
    await requestB('/v1/projects');
    assert.equal(new Headers(captured.headers).get('X-NovaWorks-Organization'), 'company-b');
  } finally { globalThis.fetch = originalFetch; }
});

test('company binary requests carry the same organization header', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, options) => { captured = options; return new Response(new Uint8Array([1, 2, 3])); };
  try {
    const response = await requestBinary('/v1/invoices/one/pdf', { organizationId: 'company-a', headers: { 'X-Client-Trace': 'trace-2' } });
    assert.equal(response.status, 200);
    assert.equal(new Headers(captured.headers).get('X-NovaWorks-Organization'), 'company-a');
    assert.equal(new Headers(captured.headers).get('X-Client-Trace'), 'trace-2');
  } finally { globalThis.fetch = originalFetch; }
});

test('company context conflict is surfaced once and never replays the write', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let recovered = 0;
  globalThis.fetch = async () => { calls += 1; return json({ error: { code: 'COMPANY_CONTEXT_CHANGED', message: 'Company changed.' } }, 409); };
  try {
    const request = createCompanyRequest('company-a', () => { recovered += 1; });
    await assert.rejects(request('/v1/projects', { method: 'POST', body: { name: 'draft' } }), error => error.code === 'COMPANY_CONTEXT_CHANGED');
    assert.equal(calls, 1);
    assert.equal(recovered, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('company requests preserve caller abort behavior', async () => {
  const originalFetch = globalThis.fetch;
  const abort = new DOMException('Aborted', 'AbortError');
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(abort), { once: true }));
  const controller = new AbortController();
  try {
    const pending = createCompanyRequest('company-a')('/v1/projects', { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
  } finally { globalThis.fetch = originalFetch; }
});

test('company request timeout remains a bounded actionable error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  try {
    await assert.rejects(createCompanyRequest('company-a')('/v1/projects', { timeoutMs: 5 }), error => error.status === 0 && error.message.includes('too long'));
  } finally { globalThis.fetch = originalFetch; }
});

test('binary company conflict preserves 409 and notifies recovery once without replay', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let recovered = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    assert.equal(new Headers(options.headers).get('X-NovaWorks-Organization'), 'company-a');
    return json({ error: { code: 'COMPANY_CONTEXT_CHANGED', message: 'Use the displayed company again.' } }, 409);
  };
  try {
    await assert.rejects(requestBinary('/v1/invoices/i1/pdf', {
      organizationId: 'company-a', onContextChanged: error => { recovered += 1; assert.equal(error.status, 409); }
    }), error => error.status === 409 && error.code === 'COMPANY_CONTEXT_CHANGED' && error.message === 'Use the displayed company again.');
    assert.equal(calls, 1);
    assert.equal(recovered, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('binary authorization errors preserve 401 and 403 statuses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => json({ error: { code: 'FORBIDDEN', message: 'Download is forbidden.' } }, 403);
  try {
    await assert.rejects(requestBinary('/v1/tasks/t1/attachments/a1/download', { organizationId: 'company-a' }), error => error.status === 403 && error.code === 'FORBIDDEN' && error.message === 'Download is forbidden.');
    globalThis.fetch = async () => json({ error: { code: 'SESSION_EXPIRED', message: 'Expired.' } }, 401);
    await assert.rejects(requestBinary('/v1/invoices/i1/pdf', { organizationId: 'company-a' }), error => error.status === 401 && error.code === 'SESSION_EXPIRED' && error.message === 'Your session has expired. Sign in again to continue.');
  } finally { globalThis.fetch = originalFetch; }
});

test('company context conflicts are classified separately from business version conflicts', () => {
  assert.equal(isCompanyContextChanged({ status: 409, code: 'COMPANY_CONTEXT_CHANGED' }), true);
  assert.equal(isCompanyContextChanged({ status: 409, code: 'VERSION_CONFLICT' }), false);
  assert.equal(isCompanyContextChanged({ status: 409 }), false);
});
