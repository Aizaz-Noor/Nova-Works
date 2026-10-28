# Billing-rate foundation acceptance

22October2026, isolated codex/erp-notifications. This implements project rates and an exact arithmetic helper, not time-to-invoice allocation or completed time billing.

Owner/admin can manage USD/GBP/PKR hourly rates for an existing customer-linked project. Project/customer/currency identity is immutable; amount/active state use version checks. One project/currency rate including inactive entries; reactivate rather than duplicate. Creation requests are idempotent; replay after later edits returns the current resource, never a historical price snapshot. Invoice allocation must snapshot rate/version/minutes separately.

022 adds composite project/customer reference and forced finance-only rate RLS. Runtime SELECT/INSERT and UPDATE(hourly_minor,active,version,updated_at), no DELETE/identitywrite. SQLite explicitly rejects noninteger amount/version/active values; BIGINT affinity alone was insufficient. Nonbypass migrator must own historical platform_project_customers to create its index. Audit failure rolls back rate changes. projects/timesheets/invoicing entitlements and company write policy apply.

GET/POST /api/v1/billing-rates, PATCH /api/v1/billing-rates/:id. UI under Timesheets→Hourly billing rates uses ordinary currency amounts, paginated customer/project/list selection, readable names, retry retention, explicit conflict review and read-only controls. Saving a rate never invoices recorded time.

calculateTimeCharges uses BigInt, per-entry HALF_UP of minutes×hourlyminor/60, sums rounded lines, rejects duplicate IDs/mixedcurrency/rangeoverflow.90minutes×12345minor/hour=18518minor;2×1minute×30minor/hour=2minor. This is a documented application rounding policy, not tax/accounting compliance advice. No inferred tax.

Actual evidence:
- Focused service3/3 PASSexit0 including replay/concurrency/CAS/FK/audit/rawSQLiteintegerguards and expired/featuredenial states.
- ActualHTTP create201/retry200/edit200/stale409/Origin403/manager403/anonymous401 PASSexit0. Combined helper/time/startup+rates10/10 PASSexit0,27097.0608ms.
- Actual PostgreSQL021→022 PASSexit0;10populatedprior tables/checksums/repeatnoop; freshrestrictedruntime, exactmaxretry, financeRLS/no-context/foreign/manager, concurrentCAS, rawidentityUPDATE/DELETE42501, auditrollback/FK. Evidence tmp/billing-rates-pg-BQfOiT/results.json. Local nonTLS only.
- Final fullbackend `npm.cmd run test:all --prefix backend`: exit0,138passed/0failed/skipped,87311.4609ms; tmp/billing-rates-backend-final.log.
- Final clientbuild56modules exit0,11.32s. Browser final rerun recorded below. Initial integration accidentally mounted editor in a child without company props; removed before browser acceptance. Earlier minor-unit UI browserpassed; label was subsequently simplified to ordinary currency and stale verifier selector corrected.

Remaining: final source browser evidence, populated022 disasterrestore, realhuman/hosted acceptance; explicit TIME invoice source, immutable unique time allocations, invoice/credit/replacement integration, reviewed preview andactualtime→invoice→PDF workflow. See TIME_BILLING_SPEC.md. FullERP/commercial launch remains open; original3039 untouched; no push/deployment.

Final ordinary-currency UI browser rerun: `node scripts/verify-billing-rates-browser.mjs` PASSexit0,5widths320–1440,zeroerrors/overflow, lostresponse201→503→retry200 exactlyonerate, actual409retainsproposedamount/explicitversionreview/save, deactivate/reload. tmp/billing-rates-browser-8ndvss/results.json.390px fullpage inspected; normal currency values shown. Fulltimeinvoice/022restore andhostedgates remainopen.
