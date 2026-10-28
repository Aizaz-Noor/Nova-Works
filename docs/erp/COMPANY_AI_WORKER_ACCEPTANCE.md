# Company AI worker and lifecycle — 20 October 2026

Base: local `1d83eea`, branch `codex/erp-foundation`. This extends the [review checkpoint](COMPANY_AI_ACCEPTANCE.md); the full ERP remains in development.

## Behavior

The new dedicated worker polls durable company jobs automatically, using the same restricted runtime database connection and membership checks as HTTP requests. It discovers only companies belonging to its configured identity and processes only those where that identity is currently OWNER/ADMIN. It does not use privileged credentials or bypass RLS. Multiple workers share the existing transactional quota/lease protocol. A process never overlaps its own polls and drains its current work when stopped.

QUEUED jobs and expired RUNNING leases are eligible. Output stops at REVIEW; workers never approve or create delivery records. Provider failures wait for an explicit administrator retry. After three interrupted attempts, automatic crash recovery closes the job as FAILED with `AI_RETRY_LIMIT`; it does not run the provider again each poll. Manual retries still consume the company's daily attempt allowance. Provider execution after a process crash is at-least-once; saved business records remain replay-safe.

Owners/admins can discard unapproved jobs with a reason and current version. Discard clears the lease and blocks processing/approval, so a late provider response cannot revive the job. The queue's outstanding-work limit is released. An already approved batch cannot be discarded through this action. The API exposes DISCARDED using the additive `discarded_at` lifecycle marker; the existing storage status is FAILED, preserving migration 009's status constraint.

After approval or discard, an explicit acknowledged action removes active job transcript/draft/issues/reason fields. Approved project/task references and counts remain; the existing delivery records, request fingerprint and audit history remain. This is active-record content removal, not secure media erasure, deletion of company business records, provider-side deletion, or deletion of older backups/WAL. Automatic retention periods and backup/provider retention policies remain a separate launch decision. No deletion policy was silently chosen.

Migration `010_company_ai_lifecycle` adds discard/redaction columns and a pending index without rewriting migration 002–009 SQL/checksums or widening grants. Runtime startup checks the new columns, so an outdated hosted schema fails closed. Fixed a serializer callback bug that allowed array indexes to enable the transcript-detail flag for list rows after the first; every list row now excludes its transcript. Job details remain administrator-only.

The UI exposes discard and confirmed content removal, refreshes queued/running status every three seconds while the view is open, and preserves mandatory human approval. Form edits still are not autosaved.

## Worker operation

Use a separately controlled long-lived process. Do not run this poll loop as a serverless API handler. Before enabling it, apply the versioned migrations with the migration connection, provision the restricted runtime role, and configure a worker identity with appropriate existing company memberships. Do not give it schema ownership or BYPASSRLS.

Server-only configuration names (see `backend/.env.example`):

- `ERP_ENABLED=1`, `COMPANY_AI_WORKER_ENABLED=1` (default is disabled).
- `COMPANY_AI_WORKER_USER_ID`: explicit existing identity ID. The entry point refuses startup without an administered company.
- `COMPANY_AI_WORKER_INTERVAL_MS`: 1000–60000, default 5000.
- `COMPANY_AI_DAILY_LIMIT`: per-company UTC attempt cap, default 20.
- Existing private database, CA and provider configuration. Never place values in client code or chat.

Start using `npm.cmd --prefix backend run worker:ai`. The production entry point performs no automatic migration. Logs contain fixed event codes and aggregate outcome counts, not transcripts, prompts, provider payloads or credentials. SIGINT/SIGTERM stop scheduling and wait for the current bounded provider operation before closing the connection. Actual worker hosting, restart supervision, monitoring and paid-provider acceptance remain open; no deployment or paid call was performed here.

## Evidence

- `node --test backend/test/*.test.js`: **88/88 PASS**, exit 0, `tmp/company-ai-worker-backend-tests.log`. New lifecycle/worker coverage includes concurrent workers, scheduled queue drain, membership boundaries, quota, stop, expired crash caps, no repeated failed-provider calls, list privacy, discard fencing and content removal preserving approved records. Final targeted company/runtime check **8/8 PASS**, including refusal of the old AI schema.
- `npm.cmd --prefix app/client run build`: **PASS**, 41 modules. Separate actual browser acceptance below supplies flow evidence.
- `node scripts/verify-local-postgres.mjs`: **PASS**, real local PostgreSQL 18.4 with the actual provisioned restricted runtime role. Competing worker polls drain Alpha once to REVIEW while Beta stays QUEUED; no work is created before human approval. HTTP discard/redaction, role denials, list privacy, quota and prior ERP core flows pass. Evidence `tmp/postgres-checks/results.json`.
- `node scripts/verify-company-ai-lifecycle-upgrade-postgres.mjs`: **PASS**, NOSUPERUSER NOBYPASSRLS migration role, 17 populated prior tables retained including a prior AI review/usage record; migration 002–009 checksums unchanged, RLS still forced, repeat migration no-op. Evidence `tmp/company-ai-lifecycle-upgrade/results.json`. Prior invoice tables are present but empty in this upgrade fixture.
- `node scripts/verify-company-ai-worker-browser.mjs` with bundled Playwright/Edge: **PASS**, actual separate scheduled fixture worker process drains a meeting without clicking Process, stops cleanly over its local test IPC channel, restarts and drains another meeting. Discard blocks revival; removal requires acknowledgement; removal of an approved source preserves the three delivery projects. Eight states at 1366/768/375/320: **32 viewport checks**, no document overflow or uncaught page errors. Evidence `tmp/company-ai-worker-browser/results.json`; narrow discarded/content-removal views visually inspected.
- `node scripts/verify-company-ai-restore.mjs data/company-ai-development.sqlite`: **PASS**, fresh online backup/restore with matching digests/counts for 28 tracked tables, integrity/FK checks. Evidence `tmp/company-ai-restore-FoYoLY/results.json` (company AI/delivery populated; unrelated finance/CRM tables empty). This is SQLite restore evidence; PostgreSQL disaster recovery remains open.
- Actual disabled production worker entry point: **PASS**, expected exit 1 with `COMPANY_AI_WORKER_ENABLED=0`, no database/provider operation.

Preview remains **http://127.0.0.1:3025**, explicitly labeled simulated extraction. Production startup does not import either fixture script. Fixture workers run only during acceptance and are stopped afterward. No hosted/demo database was changed, no remote push/deployment/message occurred, and no paid provider request was made.

Next engineering module: role-scoped sales, delivery and financial reporting backed by authoritative records. Security/recovery/MFA, subscription entitlements, private file storage, time rates/billing, PostgreSQL restore, hosted staging and the remaining original master-plan release/expansion gates remain open.
