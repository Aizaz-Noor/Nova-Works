# Scoped operational reports — 20 October 2026

Base `62782ee`, branch `codex/erp-foundation`. This checkpoint implements current sales, delivery and invoice/payment summaries plus authorized JSON exports. It does not complete the reporting sprint or the full ERP roadmap.

## Report contracts and meaning

`GET /api/v1/reports/{sales|delivery|financial}` reads a report for the authenticated session's selected company. `POST /api/v1/reports/{kind}/export` requires trusted Origin/JSON, enforces the same permissions and appends `report.exported` to company audit history. Exports return a JSON attachment; the UI downloads it and displays the same refreshed snapshot. Responses remain `Cache-Control: no-store`. The company ID in a UI response must match the displayed company before it can be shown or exported.

| Report | Company owner/admin | Manager | Member |
| --- | --- | --- | --- |
| Sales | Company deals/current quotes/orders | Only records owned by that manager | Denied |
| Delivery | Company project/task counts and approved minutes | Managed project/task counts and approved minutes | Assigned project/task counts and own historical approved minutes |
| Financial | Company issued invoices, credits and active manual payment evidence | Denied | Denied |

Sales groups records by currency and lifecycle status. Quotes marked SUPERSEDED are excluded; draft/issued/accepted/declined current terms remain distinct. Deals without a value have an explicit unpriced count. Deals, quotes and orders are separate sales-flow views; adding their amounts would double count the same business and is not presented as a total.

Delivery counts saved statuses, not inferred completion percentages. Only APPROVED time contributes minutes/billable minutes. Private drafts, pending submissions, rejected and void time are excluded. Personal time remains the worker's own approved history after task reassignment; their project/task counts reflect current assignment.

Financial totals include ISSUED invoices only, grouped separately by USD/GBP/PKR. Full credits reduce billed balances. Payment records with a reversal are excluded from current paid evidence. Payment aggregation occurs before the invoice join so multiple payment/credit rows cannot multiply invoice amounts. Outstanding is issued minus credited minus net recorded paid. Overdue is the current positive balance on an invoice whose due date precedes today's UTC date. No historical cutoff is implied. This is invoice/manual-payment evidence, not recognized revenue, cash-bank reconciliation, project cost/profit or certified accounting.

Money/minute aggregates are decimal integer strings. PostgreSQL uses exact SUM/numeric arithmetic; SQLite uses a BigInt custom SQL aggregate, including sums beyond signed 64-bit range. The UI formats arbitrary-size aggregate minor units without passing through floating-point numbers or the per-record amount cap. No FX conversion occurs. Summary result sizes are bounded by fixed statuses and supported currencies; business rows are aggregated in SQL rather than loaded into application arrays.

Reports use one PostgreSQL REPEATABLE READ transaction, established before membership/data queries. Existing operational transactions keep their previous isolation. SQLite uses the existing serialized transaction/snapshot. No table, policy, migration checksum, runtime privilege, dependency or production configuration was changed for reporting.

## Actual evidence

- `node --test backend/test/*.test.js`: **90/90 PASS**, exit 0, `tmp/reports-backend-tests.log`. New report service checks cover payments/reversal/full-credit joins, draft exclusion, separate currencies, role/tenant/filter denials, export audit, approved-time boundaries, manager ownership and 1025 maximum-value deals whose aggregate exceeds SQLite's native integer range. Final focused report run **2/2 PASS**, including current quote revision exclusion.
- `npm.cmd --prefix app/client run build`: **PASS**, 42 modules. This is compile evidence; rendered flows are below.
- `node scripts/verify-local-postgres.mjs`: **PASS**, actual local PostgreSQL 18.4 with the provisioned restricted runtime role. Report HTTP queries return 303868 issued / 293868 credited / 0 active paid / 10000 outstanding minor units; personal member approved minutes equal 90. Other-company results remain empty, manager/member finance exports are forbidden, supported currency filtering/no-store and audited export pass. A real concurrent order commits between sales report queries: the in-flight report consistently retains 303868 while the next report returns 303991. Evidence `tmp/postgres-checks/results.json`. Prior core workflows also pass in this verifier.
- `node scripts/verify-reports-browser.mjs` with bundled Playwright/Edge: **PASS**. Actual signup/company/report navigation, USD issued15000/credit5000/netpaid1000/outstanding9000, GBP-only JSON download parsed from disk, exact display of PKR18014398509481982 aggregate minor units, independent time approval/90-minute display, keyboard table focus, company switch reset, and an actual member UI limited to Delivery with finance403. Six primary states at 1366/768/375/320: **24 viewport checks**, no document overflow or uncaught page errors, plus a separate 375px member capture. Financial375px and sales320px screenshots visually inspected. Tables intentionally scroll within their focusable container on narrow screens. Evidence `tmp/reports-browser/results.json`, downloaded `financial-report.json`, PNGs.
- The first browser attempt exposed an implicit select-label issue. Explicit labels replaced the nested select labels; the corrected rendered workflow passed. The initial unit fixture incorrectly asked a manager to approve customer terms and passed a synchronously thrown validation error directly to `assert.rejects`; the fixture now uses the required administrator and the async report contract returns rejected validation promises.
- `node scripts/verify-invoicing-restore.mjs data/reports-development.sqlite`: **PASS**, fresh online SQLite backup/restore with matching digests/counts for 26 tracked tables including actual quotes/orders, invoices, payments/reversals, credit notes, approved time/review and audit data. Evidence `tmp/invoicing-restore-vnoU8q/results.json`. Some unrelated CRM tables are empty; this does not prove all-module data coverage or PostgreSQL disaster recovery.

## Preview and remaining work

Run `node scripts/start-reports-verification.mjs`: **http://127.0.0.1:3026** uses fictional local data and explicitly disables provider calls. No remote push, deployment, paid provider call, message, charge/refund or hosted database change occurred.

Reports are current all-time operational snapshots. Date-range/history reconstruction, imports, CSV/raw-record exports, drill-downs, scheduled reports, project billing rates/costs/margins, financial reconciliation, performance/load targets, hosted staging and commercial launch controls remain open. Recovery/MFA, private files, remaining project collaboration, subscription entitlements and later ERP releases also remain part of the original goal. See [plan progress](PLAN_PROGRESS.md); a green report checkpoint is not a commercial release.
