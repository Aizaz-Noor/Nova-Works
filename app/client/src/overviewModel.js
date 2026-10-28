const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);
const SALES_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

export function allowedReportKinds(role) {
  if (ADMIN_ROLES.has(role)) return ['delivery', 'sales', 'financial'];
  if (SALES_ROLES.has(role)) return ['delivery', 'sales'];
  return ['delivery'];
}

const integer = value => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new TypeError('The report contains a missing or invalid exact integer value.');
  return BigInt(value);
};

function validateRows(rows, { statuses = false, priced = false } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('The report is missing a record group.');
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.currency !== 'string' || !row.currency) throw new TypeError('The report contains an incomplete record group.');
    integer(row.count);
    integer(row.amount_minor);
    if (statuses && (typeof row.status !== 'string' || !row.status)) throw new TypeError('The report contains a record group without a status.');
    if (priced) integer(row.priced_count);
  }
}

export function validateOverviewReport(report, kind) {
  if (!report || report.kind !== kind || typeof report.organizationId !== 'string' || !report.organizationId || typeof report.scope !== 'string' || typeof report.generatedAt !== 'string' || !Number.isFinite(Date.parse(report.generatedAt))) {
    throw new TypeError('The report snapshot is incomplete. Refresh this section.');
  }
  if (kind === 'delivery') {
    for (const key of ['projects', 'tasks']) {
      if (!Array.isArray(report[key])) throw new TypeError('The delivery snapshot is missing a record group.');
      for (const row of report[key]) {
        if (!row || typeof row.status !== 'string' || !row.status) throw new TypeError('The delivery snapshot contains an incomplete status group.');
        integer(row.count);
      }
    }
    if (!report.approvedTime || typeof report.approvedTime !== 'object') throw new TypeError('The delivery snapshot is missing approved time.');
    integer(report.approvedTime.minutes); integer(report.approvedTime.billable_minutes);
  } else if (kind === 'sales') {
    validateRows(report.deals, { statuses: true, priced: true });
    validateRows(report.quotes, { statuses: true });
    validateRows(report.orders);
  } else if (kind === 'financial') {
    if (!Array.isArray(report.currencies)) throw new TypeError('The invoice snapshot is missing currency groups.');
    for (const row of report.currencies) {
      if (!row || !['USD', 'GBP', 'PKR'].includes(row.currency)) throw new TypeError('The invoice snapshot contains an unsupported currency group.');
      for (const key of ['count', 'issued_minor', 'credited_minor', 'paid_minor', 'outstanding_minor', 'overdue_minor']) integer(row[key]);
    }
  } else throw new TypeError('The report type is not supported.');
  return report;
}

export function reportAccess(role, billing) {
  const isAdmin = ADMIN_ROLES.has(role);
  const isSalesRole = SALES_ROLES.has(role);
  const entitlementKnown = billing != null;
  const reportsEnabled = entitlementKnown && !(billing.enabled && !billing.features?.reports);
  return {
    delivery: allowedReportKinds(role).includes('delivery'),
    sales: allowedReportKinds(role).includes('sales') && entitlementKnown && reportsEnabled,
    finance: allowedReportKinds(role).includes('financial') && entitlementKnown && reportsEnabled,
    salesRole: isSalesRole,
    admin: isAdmin,
    entitlementKnown,
    entitlementDenied: entitlementKnown && !reportsEnabled,
  };
}

export function managementRole(role) {
  return ADMIN_ROLES.has(role) || role === 'MANAGER';
}

export function sumCounts(rows) {
  if (!Array.isArray(rows)) throw new TypeError('The report is missing a record group.');
  return rows.reduce((sum, row) => sum + integer(row?.count), 0n).toString();
}

export function deliverySummary(report) {
  if (!report) return null;
  if (!Array.isArray(report.projects) || !Array.isArray(report.tasks) || !report.approvedTime) throw new TypeError('The delivery snapshot is incomplete.');
  const openTasks = (report.tasks || []).filter(row => ['TODO', 'IN_PROGRESS'].includes(row.status))
    .reduce((sum, row) => sum + integer(row.count), 0n);
  const minutes = integer(report.approvedTime?.minutes);
  return {
    projects: sumCounts(report.projects),
    tasks: sumCounts(report.tasks),
    openTasks: openTasks.toString(),
    approvedMinutes: minutes.toString(),
    approvedHours: (minutes / 60n).toString(),
    remainingMinutes: (minutes % 60n).toString(),
  };
}

export function financeRows(report) {
  if (!report) return null;
  if (!Array.isArray(report.currencies)) throw new TypeError('The invoice snapshot is missing currency groups.');
  return (report.currencies || []).map(row => ({
    currency: ['USD', 'GBP', 'PKR'].includes(row?.currency) ? row.currency : (() => { throw new TypeError('The invoice snapshot contains an unsupported currency.'); })(),
    invoices: integer(row.count).toString(),
    outstandingMinor: integer(row.outstanding_minor).toString(),
    overdueMinor: integer(row.overdue_minor).toString(),
  }));
}

export function formatMinor(minor, currency) {
  const amount = integer(minor);
  const sign = amount < 0n ? '-' : '';
  const absolute = amount < 0n ? -amount : amount;
  const major = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${currency} ${major}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function formatMinutes(value) {
  const minutes = integer(value);
  return `${(minutes / 60n).toString()}h ${(minutes % 60n).toString()}m`;
}

export function reportIsCurrent(report, kind, organizationId) {
  return Boolean(report && report.kind === kind && report.organizationId === organizationId);
}
