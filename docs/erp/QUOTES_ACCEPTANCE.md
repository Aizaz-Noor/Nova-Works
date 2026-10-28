# Quote and sales-order acceptance - 20 October 2026

Local candidate, branch codex/erp-foundation. No push, deployment, outbound customer message or paid call. All customers and approval references used here are fictional. This is an internal quote approval record, not independent customer identity verification.

| Check | Observed result |
| --- | --- |
| Backend suite | 75 passed,0failed; exit0 |
| Client production build | exit0 |
| Arithmetic | Exact BigInt totals, per-line half-up tax, maximum range, aggregate overflow and malformed inputs checked |
| Lifecycle | Draft/version conflicts, issue lock, superseding revision, internal approval permissions, expiry at current UTC boundary and approved immutable version checked |
| PostgreSQL18.4 | Actual restricted runtime API flow; concurrent revisions/order conversions return one creation plus one replay; other-company/member/no-contextRLS denials; issued term/item rewrite and runtime order mutation denied |
| Existing data upgrade |006 applied using NOSUPERUSER NOBYPASSRLS migration owner; populated prior business rows and002-005checksums preserved; forcedRLS on4newtables; repeat idempotent |
| Edge actual UI/API | Deal Prepare quote -> priced draft -> actual409/reload-preserve -> issue -> revised terms -> record acceptance -> immutable sales order; exact totals, oldversion denial, customer-name snapshot after rename, replay, refresh and direct customer picker creation pass |
| Responsive | Quote editor,issuedquote,salesorder andorderlist each at1366/768/375/320px:16checks,no documentoverflow or uncaughtpageerrors;320pxsalesorder visually inspected |
| Restore | OnlineSQLite backup into a fresh file matches all business rows in19tables; integrity/FKs pass. Sales test source has quotes/order; unrelated task/contact/history counts may be zero |

Commands: npm.cmd run test:all --prefix backend; npm.cmd run build --prefix app/client; node scripts/verify-local-postgres.mjs; node scripts/verify-quotes-upgrade-postgres.mjs; node scripts/verify-quotes-browser.mjs (PLAYWRIGHT_MODULE required, DEMO_URL defaults3022); node scripts/verify-quotes-restore.mjs backend/data/quotes-development.sqlite.

Artifacts remain in ignoredtmp: quotes-backend-suite.log, quotes-browser/results.json and screenshots, postgres-checks/results.json, quotes-upgrade/results.json and quotes-restore-n7L0vl/results.json. A first browser attempt stopped at an incorrect signup selector before business mutations; the verifier selector was corrected, then the flow passed. An initial PostgreSQL mutation-denial expectation was too narrow about error wording (lifecycle guard rejected it first); corrected assertion passed. These failures were not treated as passing evidence.

Limits: no email delivery, customer portal, document PDFs/numbering, fractional quantities, discounts, automated jurisdiction taxes, invoice/payment/accounting entries, hostedstaging, PostgreSQL restore or production readiness. FullERP remains active. Next planned slice: project time entries and approval protection.
