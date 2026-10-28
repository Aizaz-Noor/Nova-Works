import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedReportKinds, deliverySummary, financeRows, formatMinor, formatMinutes, reportAccess, reportIsCurrent, sumCounts, validateOverviewReport } from './overviewModel.js';

test('overview access follows company role and billing entitlement', () => {
  assert.deepEqual(reportAccess('MEMBER', { enabled: false, features: {} }), {
    delivery: true, sales: false, finance: false, salesRole: false, admin: false,
    entitlementKnown: true, entitlementDenied: false,
  });
  assert.equal(reportAccess('MANAGER', { enabled: false }).sales, true);
  assert.equal(reportAccess('MANAGER', { enabled: false }).finance, false);
  assert.equal(reportAccess('ADMIN', { enabled: true, features: { reports: false } }).sales, false);
  assert.equal(reportAccess('OWNER', { enabled: true, features: { reports: false } }).finance, false);
  assert.equal(reportAccess('OWNER', { enabled: true, features: { reports: true } }).finance, true);
  assert.equal(reportAccess('OWNER', null).finance, false);
  assert.deepEqual(allowedReportKinds('MEMBER'), ['delivery']);
  assert.deepEqual(allowedReportKinds('MANAGER'), ['delivery', 'sales']);
  assert.deepEqual(allowedReportKinds('OWNER'), ['delivery', 'sales', 'financial']);
});

test('exact status and finance aggregation preserves values beyond safe Number range', () => {
  assert.equal(sumCounts([{ count: '9007199254740993' }, { count: '7' }]), '9007199254741000');
  assert.deepEqual(deliverySummary({
    projects: [{ status: 'ACTIVE', count: '9007199254740993' }],
    tasks: [{ status: 'TODO', count: '9007199254740993' }, { status: 'IN_PROGRESS', count: '7' }, { status: 'DONE', count: '12' }],
    approvedTime: { minutes: '9007199254740999', billable_minutes: '3' },
  }), {
    projects: '9007199254740993', tasks: '9007199254741012', openTasks: '9007199254741000',
    approvedMinutes: '9007199254740999', approvedHours: '150119987579016', remainingMinutes: '39',
  });
  assert.deepEqual(financeRows({ currencies: [
    { currency: 'GBP', count: '2', outstanding_minor: '9007199254740993', overdue_minor: '0' },
    { currency: 'PKR', count: '4', outstanding_minor: '13', overdue_minor: '7' },
  ] }), [
    { currency: 'GBP', invoices: '2', outstandingMinor: '9007199254740993', overdueMinor: '0' },
    { currency: 'PKR', invoices: '4', outstandingMinor: '13', overdueMinor: '7' },
  ]);
  assert.equal(formatMinor('9007199254740993', 'USD'), 'USD 90,071,992,547,409.93');
});

test('empty snapshots remain zero while unavailable snapshots remain unavailable', () => {
  assert.equal(sumCounts([]), '0');
  assert.deepEqual(deliverySummary({ projects: [], tasks: [], approvedTime: { minutes: '0' } }), {
    projects: '0', tasks: '0', openTasks: '0', approvedMinutes: '0', approvedHours: '0', remainingMinutes: '0',
  });
  assert.equal(deliverySummary(null), null);
  assert.equal(financeRows(null), null);
  assert.deepEqual(financeRows({ currencies: [] }), []);
  assert.throws(() => financeRows({ currencies: [{ currency: 'USD', count: '1', outstanding_minor: undefined, overdue_minor: '0' }] }), /missing or invalid exact integer/);
  assert.throws(() => sumCounts([{ count: 'unknown' }]), /missing or invalid exact integer/);
  assert.throws(() => deliverySummary({ projects: [], tasks: [], approvedTime: { minutes: undefined } }), /missing or invalid exact integer/);
});

test('report payload validation rejects incomplete groups instead of showing misleading zeros', () => {
  const base = { organizationId: 'company-a', scope: 'company', generatedAt: '2026-10-23T10:00:00.000Z' };
  assert.equal(validateOverviewReport({ ...base, kind: 'delivery', projects: [], tasks: [], approvedTime: { minutes: '0', billable_minutes: '0' } }, 'delivery').kind, 'delivery');
  assert.throws(() => validateOverviewReport({ ...base, kind: 'delivery', projects: [], tasks: [] }, 'delivery'), /missing approved time/);
  assert.throws(() => validateOverviewReport({ ...base, kind: 'financial', currencies: [{ currency: 'USD', count: '0' }] }, 'financial'), /missing or invalid exact integer/);
});

test('currency groups remain separated and minute formatting is exact', () => {
  assert.equal(formatMinor('123456', 'USD'), 'USD 1,234.56');
  assert.equal(formatMinor('300', 'GBP'), 'GBP 3.00');
  assert.equal(formatMinor('70000001', 'PKR'), 'PKR 700,000.01');
  assert.equal(formatMinutes('125'), '2h 5m');
  assert.equal(formatMinutes('9007199254740993'), '150119987579016h 33m');
  assert.equal(reportIsCurrent({ kind: 'delivery', organizationId: 'a' }, 'delivery', 'a'), true);
  assert.equal(reportIsCurrent({ kind: 'sales', organizationId: 'a' }, 'delivery', 'a'), false);
  assert.equal(reportIsCurrent({ kind: 'delivery', organizationId: 'b' }, 'delivery', 'a'), false);
});
