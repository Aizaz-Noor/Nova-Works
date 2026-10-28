import React, { useEffect, useRef, useState } from 'react';
import { useCompanyRequest } from './api.js';
import { StatusVisual } from './ReportVisuals.jsx';
import { deliverySummary, financeRows, formatMinor, formatMinutes, managementRole, reportAccess, reportIsCurrent, sumCounts, validateOverviewReport } from './overviewModel.js';
import { validateSubmittedTime } from './attentionModel.js';
import './erp-insights.css';

const scopeName = scope => scope === 'company' ? 'Company-wide' : scope === 'managed' ? 'Managed work' : 'Your assigned work';

function SectionState({ state, onRetry, entitlementMessage }) {
  if (state.status === 'loading') return <p className="overview-state" role="status">Loading this snapshot…</p>;
  if (state.status === 'unavailable') return <p className="overview-state">{entitlementMessage || state.message}</p>;
  if (state.status === 'error') return <div className="overview-state overview-error" role="alert"><p>{state.message}</p><button type="button" className="secondary" onClick={onRetry}>Retry all snapshots</button></div>;
  return null;
}

function CountCard({ label, value, detail, onOpen, target, disabled }) {
  return <article className="overview-kpi"><p>{label}</p><strong>{value}</strong><span>{detail}</span>
    {target && <button type="button" className="overview-link" disabled={disabled} onClick={() => onOpen(target)}>{{delivery:'View projects & tasks',time:'Open timesheets',pipeline:'Open pipeline',quotes:'Open quotes & orders'}[target] || 'Open workspace'} →</button>}
  </article>;
}

function friendlySnapshotTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

function SnapshotMeta({ report }) {
  return <p className="overview-meta">Scope: {scopeName(report.scope)} <span aria-hidden="true">·</span> Updated <time dateTime={report.generatedAt}>{friendlySnapshotTime(report.generatedAt)} UTC</time></p>;
}

export default function OverviewWorkspace({ organization, billing, user, onNavigate, onExpired }) {
 const request = useCompanyRequest();
  const [revision, setRevision] = useState(0);
  const [sections, setSections] = useState({ delivery: { status: 'loading' }, sales: { status: 'unavailable' }, financial: { status: 'unavailable' } });
  const [teamReview, setTeamReview] = useState({ status: 'loading' });
  const [teamRevision, setTeamRevision] = useState(0);
  const teamGeneration = useRef(0);
  const generation = useRef(0);
  const expired = useRef(onExpired); expired.current = onExpired;
  const currentBilling = billing?.organizationId === organization.id ? billing : null;
  const access = reportAccess(organization.role, currentBilling);
  const billingEnabled = Boolean(currentBilling?.enabled);
  const reportsFeature = currentBilling?.features?.reports;
  const contextKey = `${user?.id || 'unknown'}|${organization.id}|${organization.role}|${currentBilling?.organizationId || 'pending'}|${billingEnabled}|${reportsFeature === true ? 'on' : reportsFeature === false ? 'off' : 'default'}`;

  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    const allowed = reportAccess(organization.role, currentBilling);
    let handled401 = false;
    setSections({
      delivery: { status: 'loading', contextKey },
      sales: allowed.sales ? { status: 'loading', contextKey } : { status: 'unavailable', contextKey, message: allowed.entitlementKnown ? allowed.entitlementDenied ? 'Sales summaries are unavailable because Reports is not included in this company plan.' : 'Sales summaries are not available for this role.' : 'Checking company report access.' },
      financial: allowed.finance ? { status: 'loading', contextKey } : { status: 'unavailable', contextKey, message: allowed.entitlementKnown ? allowed.entitlementDenied ? 'Invoice summaries are unavailable because Reports is not included in this company plan.' : 'Invoice summaries are available to owners and administrators.' : 'Checking company report access.' },
    });

    const load = async kind => {
      try {
        const report = await request(`/v1/reports/${kind}`, { signal: controller.signal });
        if (current !== generation.current || controller.signal.aborted) return;
        validateOverviewReport(report, kind);
        if (!reportIsCurrent(report, kind, organization.id)) throw new Error('This snapshot belongs to a different company or report. Refresh the company workspace before continuing.');
        setSections(previous => ({ ...previous, [kind]: { status: 'ready', report, contextKey } }));
      } catch (error) {
        if (error.name === 'AbortError' || current !== generation.current) return;
        if (error.status === 401 && !handled401) { handled401 = true; expired.current?.(); }
        const message = error.status === 403 ? 'Access changed while loading. Refresh the company workspace to check current permissions.'
          : error.status === 402 ? 'Reports are not included in the current company plan.'
            : error.message || 'This snapshot could not be loaded. Try again.';
        setSections(previous => ({ ...previous, [kind]: { status: 'error', message, contextKey } }));
      }
    };
    void load('delivery');
    if (allowed.sales) void load('sales');
    if (allowed.finance) void load('financial');
    return () => { if (generation.current === current) generation.current += 1; controller.abort(); };
  }, [user?.id, organization.id, organization.role, billing?.organizationId, billingEnabled, reportsFeature, revision]);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++teamGeneration.current;
    const requestContext = contextKey;
    if (!managementRole(organization.role)) {
      setTeamReview({ status: 'unavailable', contextKey: requestContext, message: 'Submitted team time is available to managers and company administrators.' });
      return () => { if (teamGeneration.current === current) teamGeneration.current += 1; controller.abort(); };
    }
    setTeamReview({ status: 'loading', contextKey: requestContext });
    const load = async () => {
      try {
        const payload = await request('/v1/time-entries?scope=team&status=SUBMITTED&page=1&limit=5', { signal: controller.signal });
        if (current !== teamGeneration.current || controller.signal.aborted) return;
        const result = validateSubmittedTime(payload);
        setTeamReview({ status: 'ready', ...result, contextKey: requestContext });
      } catch (error) {
        if (error.name === 'AbortError' || current !== teamGeneration.current) return;
        if (error.status === 401) expired.current?.();
        if ([402, 403].includes(error.status)) {
          const message = error.status === 402 ? 'Team time is not included in the current company plan.' : 'You no longer have permission to view submitted team time.';
          setTeamReview({ status: 'unavailable', message, contextKey: requestContext });
          return;
        }
        setTeamReview({ status: 'error', message: error.message || 'Submitted team time could not be loaded.', contextKey: requestContext });
      }
    };
    void load();
    return () => { if (teamGeneration.current === current) teamGeneration.current += 1; controller.abort(); };
  }, [contextKey, organization.role, teamRevision]);

  const navigate = (target, options) => onNavigate?.(target, options);
  const retry = () => { setRevision(value => value + 1); setTeamRevision(value => value + 1); };
  const forContext = section => section?.contextKey === contextKey ? section : { status: 'loading' };
  const delivery = forContext(sections.delivery);
  const sales = forContext(sections.sales);
  const financial = forContext(sections.financial);
  const review = teamReview?.contextKey === contextKey ? teamReview : { status: 'loading' };
  const summary = deliverySummary(delivery?.status === 'ready' ? delivery.report : null);
  const finance = financeRows(financial?.status === 'ready' ? financial.report : null);
  const taskRows = delivery?.status === 'ready' ? delivery.report.tasks || [] : [];

  return <section className="overview-workspace" aria-labelledby="overview-title" aria-busy={[delivery, sales, financial, review].some(section => section.status === 'loading')}>
    <header className="overview-heading">
      <div><p className="insight-eyebrow">Company / Overview</p><h2 id="overview-title">Company overview</h2>
        <p className="overview-intro">A current view of your permitted company work for <strong>{organization.name}</strong>.</p>
      </div>
      <button type="button" className="secondary overview-refresh" onClick={retry}>Refresh overview</button>
    </header>

    <section className="overview-attention" aria-label="Work that needs attention">
      <article className="attention-card"><div><p className="insight-eyebrow">Delivery</p><h3>Open work</h3></div>
        {delivery.status === 'ready' ? <><strong>{summary.openTasks}</strong><p>{summary.openTasks === '1' ? 'open task in your permitted scope' : 'open tasks in your permitted scope'}</p><button type="button" className="overview-link" onClick={() => navigate('delivery')}>View projects &amp; tasks →</button></> : delivery.status === 'error' ? <div className="attention-state" role="alert"><p>{delivery.message}</p><button type="button" className="overview-link" onClick={retry}>Retry →</button></div> : delivery.status === 'unavailable' ? <p>{delivery.message}</p> : <p role="status">Loading open work…</p>}
      </article>
      {access.admin || organization.role === 'MANAGER' ? <article className="attention-card"><div><p className="insight-eyebrow">Time review</p><h3>Submitted team time</h3></div>
        {review.status === 'ready' ? <><strong>{review.total}</strong><p>{review.total === '1' ? 'submitted entry' : 'submitted entries'} · may include your own; self-approval is not allowed</p><ul className="attention-list">{review.entries.map(entry => <li key={entry.id}><span><b>{entry.workerName}</b><small>{entry.projectName}</small></span><span>{formatMinutes(String(entry.minutes))}</span></li>)}</ul><button type="button" className="overview-link" onClick={() => navigate('time', { scope: 'team' })}>Review team time →</button></> : review.status === 'loading' ? <p role="status">Loading submitted team time…</p> : review.status === 'error' ? <div className="attention-state" role="alert"><p>{review.message}</p><button type="button" className="overview-link" onClick={() => setTeamRevision(value => value + 1)}>Retry →</button></div> : <p>{review.message}</p>}
      </article> : null}
      {access.admin ? <article className="attention-card"><div><p className="insight-eyebrow">Finance</p><h3>Outstanding invoices</h3></div>
        {financial.status === 'ready' ? <>{finance?.length ? <ul className="attention-finance">{finance.map(row => <li key={row.currency}><span>{row.currency}</span><strong>{formatMinor(row.outstandingMinor, row.currency)}</strong></li>)}</ul> : <p>No issued invoices in this scope.</p>}<p>Exact outstanding balances, grouped by currency.</p><button type="button" className="overview-link" onClick={() => navigate('invoices', { status: 'ISSUED' })}>View issued invoices →</button></> : financial.status === 'error' ? <div className="attention-state" role="alert"><p>{financial.message}</p><button type="button" className="overview-link" onClick={retry}>Retry →</button></div> : financial.status === 'unavailable' ? <p>{financial.message}</p> : <p role="status">Loading invoice balances…</p>}
      </article> : null}
    </section>

    <section className="overview-section" aria-labelledby="overview-delivery-title">
      <div className="overview-section-heading"><div><p className="insight-eyebrow">Delivery</p><h3 id="overview-delivery-title">Projects and approved time</h3></div>
        {delivery?.status === 'ready' && <SnapshotMeta report={delivery.report} />}
      </div>
      <SectionState state={delivery} onRetry={retry} />
      {summary && <>
        <div className="overview-kpis">
          <CountCard label="Projects" value={summary.projects} detail="In your current delivery scope" target="delivery" onOpen={navigate}/>
          <CountCard label="Open tasks" value={summary.openTasks} detail="To do and in progress in your scope" target="delivery" onOpen={navigate}/>
          <CountCard label="Approved time" value={formatMinutes(summary.approvedMinutes)} detail={`${summary.approvedMinutes} exact minutes · recorded, not estimated`} target="time" onOpen={navigate}/>
        </div>
        {taskRows.length ? <StatusVisual title="Task distribution" rows={taskRows} /> : <div className="overview-status-panel"><div><h4>Task distribution</h4><p>No tasks in this scope yet. These counts describe current status, not work completed.</p></div><button type="button" className="overview-inline-action" onClick={() => navigate('delivery')}>Open Projects &amp; tasks</button></div>}
      </>}
    </section>

    {access.salesRole && <section className="overview-section" aria-labelledby="overview-sales-title">
      <div className="overview-section-heading"><div><p className="insight-eyebrow">Sales</p><h3 id="overview-sales-title">Current sales records</h3></div>{sales?.status === 'ready' && <SnapshotMeta report={sales.report} />}</div>
      <SectionState state={sales} onRetry={retry} />
      {sales?.status === 'ready' && <>
        <div className="overview-kpis overview-kpis-sales">
          <CountCard label="Deals" value={sumCounts(sales.report.deals)} detail={sales.report.scope === 'managed' ? 'Opportunities you own' : 'Current opportunities'} target="pipeline" onOpen={navigate}/>
          <CountCard label="Quotes" value={sumCounts(sales.report.quotes)} detail="Current versions; superseded versions excluded" target="quotes" onOpen={navigate}/>
          <CountCard label="Orders" value={sumCounts(sales.report.orders)} detail="Accepted sales orders" target="quotes" onOpen={navigate}/>
        </div>
        <p className="overview-note">Counts describe current records, not a time trend. Stages and currencies remain separate.</p>
      </>}
    </section>}

    {access.admin && <section className="overview-section" aria-labelledby="overview-finance-title">
      <div className="overview-section-heading"><div><p className="insight-eyebrow">Finance</p><h3 id="overview-finance-title">Issued invoice balances</h3></div>{financial?.status === 'ready' && <SnapshotMeta report={financial.report} />}</div>
      <SectionState state={financial} onRetry={retry} />
      {finance && <>{finance.length ? <div className="overview-finance-grid">{finance.map(row => <article className="overview-finance-card" key={row.currency}>
        <h4>{row.currency}</h4><dl><div><dt>Issued invoices</dt><dd>{row.invoices}</dd></div><div><dt>Outstanding</dt><dd>{formatMinor(row.outstandingMinor, row.currency)}</dd></div><div><dt>Overdue outstanding</dt><dd>{formatMinor(row.overdueMinor, row.currency)}</dd></div></dl>
      </article>)}</div> : <p className="overview-empty">No issued invoices in this scope. Draft invoices are not included. <button type="button" className="overview-inline-action" onClick={() => navigate('invoices')}>Open Invoices</button></p>}
        <p className="overview-note">Invoice and recorded payment evidence only. Draft invoices are excluded; currencies are kept separate. These figures are not revenue, cash balance or profit.</p>
      </>}
    </section>}

    <nav className="overview-actions" aria-label="Company workspace actions"><div><p className="insight-eyebrow">Continue work</p><h3>Open a workspace</h3></div><div className="overview-action-links">
      <button type="button" onClick={() => navigate('delivery')}>Projects &amp; tasks <span aria-hidden="true">→</span></button>
      <button type="button" onClick={() => navigate('time')}>Timesheets <span aria-hidden="true">→</span></button>
      {access.salesRole && <button type="button" onClick={() => navigate('pipeline')}>Pipeline <span aria-hidden="true">→</span></button>}
      {access.admin && <button type="button" onClick={() => navigate('invoices')}>Invoices <span aria-hidden="true">→</span></button>}
      <button type="button" onClick={() => navigate('reports')}>Reports <span aria-hidden="true">→</span></button>
      <button type="button" onClick={() => navigate('settings')}>Settings <span aria-hidden="true">→</span></button>
    </div></nav>
    <p className="overview-footer">Report sections refresh independently. Their timestamps can differ because each report is a separate current snapshot.</p>
  </section>;
}
