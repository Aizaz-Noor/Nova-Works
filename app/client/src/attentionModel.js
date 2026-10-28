const exactCount = value => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new TypeError('The team time response contains an invalid total.');
};

export function validateSubmittedTime(payload) {
  if (!payload || !Array.isArray(payload.entries) || !payload.pagination || !Array.isArray(payload.entries)) {
    throw new TypeError('The submitted team time response is incomplete.');
  }
  const total = exactCount(payload.pagination.total);
  for (const entry of payload.entries) {
    if (!entry || typeof entry.id !== 'string' || typeof (entry.worker_name ?? entry.workerName) !== 'string' || typeof (entry.project_name ?? entry.projectName) !== 'string' || entry.status !== 'SUBMITTED') {
      throw new TypeError('The submitted team time response contains an incomplete entry.');
    }
    if (typeof entry.minutes !== 'number' || !Number.isSafeInteger(entry.minutes) || entry.minutes < 1) {
      throw new TypeError('The submitted team time response contains invalid minutes.');
    }
  }
  return { total, entries: payload.entries.map(entry => ({ ...entry, workerName: entry.worker_name ?? entry.workerName, projectName: entry.project_name ?? entry.projectName })) };
}
