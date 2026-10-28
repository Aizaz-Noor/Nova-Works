import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmittedTime } from './attentionModel.js';

test('submitted team time preserves exact totals and only accepts submitted entries', () => {
  const payload = { pagination: { total: '9007199254740993' }, entries: [{ id: 't1', worker_name: 'A', project_name: 'P', status: 'SUBMITTED', minutes: 45 }] };
  assert.deepEqual(validateSubmittedTime(payload), { total: '9007199254740993', entries: [{ ...payload.entries[0], workerName: 'A', projectName: 'P' }] });
});

test('submitted team time rejects missing, malformed, or non-submitted records', () => {
  assert.throws(() => validateSubmittedTime(null), /incomplete/);
  assert.throws(() => validateSubmittedTime({ pagination: { total: -1 }, entries: [] }), /invalid total/);
  assert.throws(() => validateSubmittedTime({ pagination: { total: 1 }, entries: [{ id: 't1', workerName: 'A', projectName: 'P', status: 'APPROVED', minutes: 45 }] }), /incomplete entry/);
});
