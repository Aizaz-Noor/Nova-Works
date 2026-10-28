# Timesheet acceptance - 20 October 2026

Local codex/erp-foundation candidate; no push/deployment/email/paidcall. Fictional company, task and review notes. Independent implementation/testing passes by the primary agent; no independent agent review claimed.

| Check | Actual result |
| --- | --- |
| Backend suite |78passed,0failed,exit0 |
| Client build |Production build exit0 |
| Business rules |Own/task/project scope,private drafts,manager project restriction,selfreview denial,current assignment checks,strict types/dates,request-key replay/mismatch,dailycap/discard,version conflicts,rejection/resubmission/history,immutable approved rows and filtered full-result summaries pass |
| Real PostgreSQL18.4 |Restricted LOGIN runtime/API flow; concurrent same-key creation creates one record; two800min same-worker/day requests yield one201/one409; concurrent review yields one200/one409; no-contextRLS/othercompany/member/selfreview denial; submitted+approved raw rewrite and history deletion denied; restart retains approval |
| Existing-company upgrade |007 applied with NOSUPERUSER NOBYPASSRLS migration owner; prior13populated business tables and002-006checksums preserved; forcedRLS on both newtables; rerun idempotent |
| Edge actual workflow |Separate worker andmanager accounts; real permittedproject/task picker; duplicate-safecreate; actual409reload preserves draft; rejects firstsubmission,worker edits/resubmits,manager approvessecond; history and readonly approved state survive refresh; teamapprovedbillable summary exactly60minutes |
| Rendered/keyboard |Editor,submittedtime,managerreview,approvedtime,teamsummary at1366/768/375/320:20checks,nooverflow or uncaughtpageerrors; duration-to-billable keyboardfocus checked;320px managerreview visually inspected |
| Restore |OnlineSQLite backup/freshrestore exactmatch21tables,integrity/FKs pass. Source has actual time,2reviewdecisions andtask; sales/customer tables empty in this particular drill |

Commands: npm.cmd run test:all --prefix backend; npm.cmd run build --prefix app/client; node scripts/verify-local-postgres.mjs; node scripts/verify-timesheets-upgrade-postgres.mjs; node scripts/verify-timesheets-browser.mjs (PLAYWRIGHT_MODULE required,DEMO_URL defaults3023); node scripts/verify-timesheets-restore.mjs backend/data/timesheets-development.sqlite.

Artifacts in ignoredtmp: timesheets-backend-suite.log,postgres-checks/results.json,timesheets-upgrade/results.json,timesheets-browser/results.json andscreenshots,timesheets-restore-PIAoXK/results.json. InitialPostgreSQL migration rejected an unparenthesizedCASE expression in a PL/pgSQL condition; its transaction rolledback. It was corrected before successful migration/application startup. SQLite-only tests/build were not treated as PostgreSQL proof.

Limits: no billingrates,invoice/payment/payroll/revenue records,approved-time corrections,notifications/timers,hostedstaging orPostgreSQL disasterrecovery. Currentworkdate boundary is explicitlyUTC. FullERP/commercial launch remains incomplete. Next masterplan slice: controlled invoicing,PDFs,payments andcorrections; do not equateapproved timewithinvoiced time.
