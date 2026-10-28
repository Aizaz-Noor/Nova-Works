# Company AI review checkpoint — 20 October 2026

Base: local `2f21398`, branch `codex/erp-foundation`. This is a bounded local milestone in the approved ERP roadmap. The full ERP and commercial release gates remain open.

## Implemented behavior

Owner/admin submits a meeting with a request ID, explicitly processes its durable job, reviews and corrects structured project/task fields, then approves. Extraction never creates delivery records. Approval validates the entire edited draft against current company memberships and saves every project/task, approval result and audit event in one transaction. Repeated approval returns the original saved result, including when another tab approved first.

Migration `009_company_ai` adds company jobs and daily usage under forced PostgreSQL RLS. Previous migration SQL/checksums are unchanged. Runtime provisioning/startup validation includes both tables; runtime has SELECT/INSERT/UPDATE, no DELETE. All HTTP operations require a signed-in company owner/admin; browser writes require trusted Origin/JSON. The public legacy demo workflow retains its original roles and contracts.

The company provider adapter supplies only current company member IDs, names and roles, never global demo employees, credentials or email addresses. Company manager roles are OWNER/ADMIN/MANAGER; any current member may receive tasks. Existing date/scope/assignment validation applies, with 200-character names/titles, 5000-character descriptions, 10 projects and 100 tasks maximum. Raw invalid structured output can be corrected in the form. Original meeting text is available in job details; job lists omit the transcript.

An explicit processing request claims a 120-second durable lease, releases its database connection, and calls the existing 90-second provider adapter. Another process cannot normally run that lease. An expired lease can be retried; late responses cannot replace a newer attempt. Exactly-once provider execution cannot be guaranteed after crashes/lease expiry. Provider failures retain a safe error code and create no work. Default cap is 20 attempts/company/UTC day, configured using `COMPANY_AI_DAILY_LIMIT`; failures, missing configuration and expired retries count. Quota and claim updates serialize across processes with a tenant advisory transaction lock. Queue holds at most 50 QUEUED/RUNNING/REVIEW jobs per company.

## Actual verification

- `node --test backend/test/*.test.js`: **85/85 PASS**, exit 0; `tmp/company-ai-backend-tests.log`. Includes four new company tests for role/tenant denials, directory field allowlist/prompt roles, review-before-save, edits, replay/concurrency, stale-version/invalid-reference denial, quota across service instances, failure, expired lease fencing, and injected task-storage failure rolling back the full approval. Legacy AI regression tests pass.
- `npm.cmd --prefix app/client run build`: **PASS**, exit 0, 41 modules. This is compile evidence; flow evidence is below.
- `node scripts/verify-local-postgres.mjs`: **PASS** against actual local PostgreSQL 18.4 using the provisioned restricted runtime role. Real HTTP company/member denials, concurrent processing/approval, zero work before approval, corrected names, persisted quota/approved replay across server restart, raw no-context job/usage RLS, plus prior CRM/sales/time/invoice core flows. Evidence `tmp/postgres-checks/results.json`.
- `node scripts/verify-company-ai-upgrade-postgres.mjs`: **PASS** under a NOSUPERUSER NOBYPASSRLS migration role; 15 populated prior tables preserved, migration 002–008 checksums unchanged, new tables FORCE RLS, second migration run is a no-op. Evidence `tmp/company-ai-upgrade/results.json`. Prior invoice tables exist in this upgrade fixture but contain no invoices; populated invoice acceptance remains documented in the preceding milestone.
- `node scripts/verify-company-ai-browser.mjs` with bundled Playwright and Edge: **PASS**, actual signup/company/queue/process/edit/approve/refresh/failure/retry-focus flows. A competing tab approval returns the saved original without duplication; a separate reviewed name and 12.5-hour estimate persist. Queued/review/approved/failure screens at 1366/768/375/320: 16 checks, no document overflow or uncaught page errors. Narrow review screenshot visually inspected. Evidence `tmp/company-ai-browser/results.json` and PNGs. First run stopped on an ambiguous test selector after successful approval; the corrected heading selector passed.
- `node scripts/verify-company-ai-restore.mjs data/company-ai-development.sqlite`: **PASS**, fresh online SQLite backup/restore, matching digests/counts for 28 tracked tables, integrity and foreign keys. Evidence `tmp/company-ai-restore-9dfoPd/results.json`. Company jobs/usage/projects/tasks populated; unrelated CRM/finance tables empty in this fixture. This does not replace a PostgreSQL backup/restore drill.

## Preview and limits

`node scripts/start-company-ai-verification.mjs` serves **http://127.0.0.1:3025** against fictional local SQLite data. The screen explicitly says **Verification fixture: simulated extraction. No live AI provider is called.** Fixture code is a separate verification entry point; production startup does not select it. A transcript containing `[fail]` exercises fixture failure. Production uses the configured real provider adapter; no paid provider execution was authorized or verified here.

Processing is explicitly started by an administrator and the HTTP request waits for extraction. This checkpoint does **not** claim an autonomous background worker or scheduled queue drain. Form edits are local until approval and are lost on navigation/reload; do not imply draft autosave. Discard/rejection/retention controls, automatic worker scheduling, meeting file upload, per-provider token/cost accounting, actual paid-provider acceptance, PostgreSQL restore, hosted staging and launch operations remain open. Do not expose this checkpoint as a commercially ready service.

No deployment, remote push, outbound message, live charge/refund, or paid AI request was performed. No dependency was added for this slice. Next bounded work: queue worker/rejection/retention before treating the commercial AI module as complete, then reporting and subscription/billing gates.


Follow-up: [worker/lifecycle acceptance](COMPANY_AI_WORKER_ACCEPTANCE.md) supersedes the earlier manual-processing/discard limitations with verified automatic worker, discard and content-removal controls. Other listed gaps remain open.
