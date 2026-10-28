import { DeliveryVisuals, SalesFlow } from './ReportVisuals.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { useCompanyRequest } from './api.js';
import { allowedReportKinds } from './overviewModel.js';
import './erp-insights.css';

const label = value => String(value).toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
function money(value, currency) {
  const amount = BigInt(value);
  const sign = amount < 0n ? '-' : '';
  const absolute = amount < 0n ? -amount : amount;
  return `${sign}${currency} ${String(absolute / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(absolute % 100n).padStart(2, '0')}`;
}
function Values({ entries }) { return <dl className="report-values">{entries.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>; }
function SalesTable({ title, rows, priced = false, status = true }) {
  return <section className="transcript-panel"><h3>{title}</h3>{!rows.length ? <p className="muted">No matching records.</p> : <div className="report-table-wrap" tabIndex={0} role="region" aria-label={`${title} table`}><table className="report-table"><caption>{title} by currency{status ? ' and status' : ''}</caption><thead><tr>{status && <th scope="col">Status</th>}<th scope="col">Currency</th><th scope="col">Records</th>{priced && <th scope="col">Without value</th>}<th scope="col">{priced ? 'Known value' : 'Total terms'}</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.currency}-${row.status || 'orders'}`}>{status && <th scope="row">{label(row.status)}</th>}<td>{row.currency}</td><td>{row.count}</td>{priced && <td>{String(BigInt(row.count) - BigInt(row.priced_count))}</td>}<td>{money(row.amount_minor, row.currency)}</td></tr>)}</tbody></table></div>}</section>;
}

export default function ReportWorkspace({ organization, onExpired }) {
 const request = useCompanyRequest();
  const admin = ['OWNER', 'ADMIN'].includes(organization.role);
  const manager = admin || organization.role === 'MANAGER';
  const [kind, setKind] = useState('delivery');
  const [currency, setCurrency] = useState('');
  const [report, setReport] = useState(null);
  const [reportContext, setReportContext] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const generation = useRef(0);
  const expired = useRef(onExpired); expired.current = onExpired;
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1; }; }, []);

  const visibleKind = allowedReportKinds(organization.role).includes(kind) ? kind : 'delivery';
  const contextKey = `${organization.id}|${organization.role}|${visibleKind}|${visibleKind === 'delivery' ? '' : currency}`;
  const activeContext = useRef(contextKey); activeContext.current = contextKey;
  const visibleReport = reportContext === contextKey && report?.kind === visibleKind && report?.organizationId === organization.id ? report : null;
  useEffect(() => {
    if (visibleKind !== kind) setKind(visibleKind);
  }, [visibleKind, kind]);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setLoading(true); setBusy(false); setError(''); setNotice(''); setReport(null);
    const queryKind = allowedReportKinds(organization.role).includes(kind) ? kind : 'delivery';
    const path = `/v1/reports/${queryKind}${currency && queryKind !== 'delivery' ? `?currency=${currency}` : ''}`;
    request(path, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted || generation.current !== current || !alive.current || activeContext.current !== `${organization.id}|${organization.role}|${queryKind}|${queryKind === 'delivery' ? '' : currency}`) return;
      if (value.kind !== queryKind || value.organizationId !== organization.id) throw new Error('Company or report context changed. Reload the company workspace before viewing reports.');
      setReport(value);
      setReportContext(`${organization.id}|${organization.role}|${queryKind}|${queryKind === 'delivery' ? '' : currency}`);
    }).catch(problem => {
      if (problem.name === 'AbortError' || controller.signal.aborted || generation.current !== current || !alive.current) return;
      if (problem.status === 401) expired.current?.();
      setError(problem.status === 402 || problem.status === 403 ? 'Report access is unavailable for your current role or company plan.' : problem.message || 'The report could not be loaded.');
    }).finally(() => { if (!controller.signal.aborted && generation.current === current && alive.current) setLoading(false); });
    return () => { if (generation.current === current) generation.current += 1; controller.abort(); };
  }, [organization.id, organization.role, visibleKind, kind, currency, revision, manager]);

  async function download() {
    const current = generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request(`/v1/reports/${visibleKind}/export`, { method: 'POST', body: currency && visibleKind !== 'delivery' ? { currency } : {} });
      if (!alive.current || current !== generation.current || activeContext.current !== contextKey) return;
      if (result.kind !== visibleKind || result.organizationId !== organization.id) throw new Error('Company or report context changed. Reload before exporting.');
      setReport(result);
      setReportContext(contextKey);
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `novaworks-${visibleKind}-report.json`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Report exported. The displayed snapshot now matches the download.');
    } catch (problem) {
      if (alive.current && current === generation.current && activeContext.current === contextKey) {
        if (problem.status === 401) expired.current?.();
        setError(problem.status === 402 || problem.status === 403 ? 'Report access is unavailable for your current role or company plan.' : problem.message || 'The report could not be exported.');
      }
    } finally { if (alive.current && current === generation.current) setBusy(false); }
  }

  const scope = visibleReport?.scope === 'company' ? 'Company-wide' : visibleReport?.scope === 'managed' ? (visibleKind === 'sales' ? 'Sales you own' : 'Projects you manage') : 'Your assigned delivery and approved time';
  return <section className="report-workspace" aria-labelledby="report-title" aria-busy={loading || busy}>
    <div className="report-page-heading"><div><p className="insight-eyebrow">NovaWorks / Intelligence</p><h2 id="report-title">Company reports</h2><p className="muted">A clear view of delivery, sales and recorded payments.</p></div><span className="report-live-label">Saved company records</span></div>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice success" role="status">{notice}</p>}
    <div className="list-tools report-controls"><div><label htmlFor="report-kind">Report type</label><select id="report-kind" value={visibleKind} disabled={busy} onChange={event => { setReport(null); setNotice(''); setKind(event.target.value); }}><option value="delivery">Delivery</option>{manager && <option value="sales">Sales</option>}{admin && <option value="financial">Invoice &amp; payment evidence</option>}</select></div>
      {visibleKind !== 'delivery' && <div><label htmlFor="report-currency">Report currency</label><select id="report-currency" value={currency} disabled={busy} onChange={event => { setReport(null); setNotice(''); setCurrency(event.target.value); }}><option value="">All currencies, kept separate</option>{['USD', 'GBP', 'PKR'].map(value => <option key={value}>{value}</option>)}</select></div>}
      <button className="secondary" disabled={busy || loading} onClick={() => { setNotice(''); setRevision(value => value + 1); }}>Refresh report</button><button className="secondary" disabled={busy || loading || !visibleReport} onClick={download}>Export report JSON</button>
    </div>
    {loading && <p role="status">Loading report…</p>}
    {visibleReport && <><p className="muted">Scope: {scope}. Snapshot: <time dateTime={visibleReport.generatedAt}>{visibleReport.generatedAt} UTC</time>.</p>
      {visibleKind === 'sales' && <><SalesFlow report={visibleReport} /><p>Current records, not historical period totals. Quotes, orders and deals are separate views of the sales flow; their amounts must not be added together. Superseded quote versions are excluded.</p><SalesTable title="Deals" rows={visibleReport.deals} priced /><SalesTable title="Current quotes" rows={visibleReport.quotes} /><SalesTable title="Accepted sales orders" rows={visibleReport.orders} status={false} /></>}
      {visibleKind === 'delivery' && <><DeliveryVisuals report={visibleReport} /><p className="muted report-note">Status counts reflect your current permissions. They do not measure percentage completion. Personal approved time includes historical entries after reassignment.</p></>}
      {visibleKind === 'financial' && <><p>Current issued-invoice and manual payment evidence. Draft invoices are excluded. Payments exclude reversed records; credits reduce outstanding balances. Overdue means a positive balance with a due date before today (UTC). This view does not calculate revenue recognition, project costs, profit or foreign exchange.</p>{!visibleReport.currencies.length && <p className="transcript-panel">No issued invoices in this currency scope.</p>}{visibleReport.currencies.map(row => <section className="transcript-panel financial-insight" key={row.currency}><h3>{row.currency} invoice evidence</h3><Values entries={[["Issued invoices", row.count], ["Issued total", money(row.issued_minor, row.currency)], ["Full credits", money(row.credited_minor, row.currency)], ["Recorded net payments", money(row.paid_minor, row.currency)], ["Outstanding", money(row.outstanding_minor, row.currency)], ["Overdue outstanding", money(row.overdue_minor, row.currency)]]} /></section>)}</>}
    </>}
  </section>;
}
