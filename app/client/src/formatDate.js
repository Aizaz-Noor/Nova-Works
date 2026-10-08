const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// API deadlines are calendar dates, not timestamps in the viewer's timezone.
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value !== 'string') return 'Date unavailable';
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Date unavailable';
  const parsed = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== day) return 'Date unavailable';
  return formatter.format(parsed);
}