# Task comments â€” backend acceptance

21 October 2026. Local implementation of the task-comment collaboration workflow; broader collaboration remains unfinished.

`GET /api/v1/tasks/:id/comments` returns an ascending, deterministic paged thread (25 default,100 maximum). `POST` accepts only `{body,requestId}`; requestId is a client-generated UUID. The server assigns the current authenticated author. Text is plain content, trimmed, nonempty, at most5000 characters, with control characters rejected except line breaks/tabs. The future interface must render it as text.

Access follows the current task model: owners/admins, the assigned project manager, or the assigned member. An unassigned member or another project manager receives404; foreign organization membership is denied. Task reassignment changes thread access. Project-wide membership and moderation remain separate roadmap requirements.

Migration018 adds composite company/task and company/author membership foreign keys, a thread index, and company/author/request uniqueness. PostgreSQL forces task-scoped read/insert RLS, checks current-user authorship, and grants the runtime SELECT/INSERT only. SQLite rejects UPDATE/DELETE through triggers. No edit/delete API is exposed. This initial append-only design does not implement legal erasure or moderation.

Comment and minimal audit event commit together. Identical retries reuse the original comment without another audit; a changed body/task for the same visible request produces409. Independent PostgreSQL service instances serialize an author/request key. Billing enforces the projects entitlement and read-only state. No email, notification, external service, migration against hosted data or deployment occurred.

## Actual verification

- `node --test backend/test/task-comments.test.js backend/test/runtime-startup.test.js`: exit0,2/2 PASS. Exercises actual HTTP login/company selection/comment POST201, retry200, thread read and hostile-Origin403, plus service access, input limits, paging, immutable history and audit-failure rollback.
- `node scripts/verify-task-comments-postgres.mjs`: exit0/PASS on disposable loopback PostgreSQL18. Restricted nonowner runtime; two service instances save one retry result; no-context/unassigned/foreign reads empty; forged author and UPDATE/DELETE42501; audit failure rolls back the comment. Evidence `tmp/task-comments/postgres-results.json` is ignored and contains no credentials. Local fixture uses nonTLS transport; production transport has not been verified.
- `npm.cmd run test:all --prefix backend`: exit0,121 passed,0 failed/skipped,35941.2435ms. Log: ignored `tmp/comments-backend.log`.
- `git diff --check`: exit0.

Not yet verified: rendered interface/browser behavior, comment-specific rate/load acceptance, populated017â†’018 upgrade preservation, backup/restore of comment data, production deployment or real customer workflows. These remain required follow-ups; backend tests alone do not complete collaboration or the ERP launch.


## Interface acceptance

`TaskComments` opens inline beneath the authorized task, loads only on first opening, preserves a draft across collapse/reopen, and renders server text through React text nodes. The composer is labeled, bounded to5000 characters and disabled while saving; author names and localized timestamps accompany persisted notes. A request UUID stays attached to an unchanged draft after a failed response, so a retry checks the same operation. Successful posting clears the composer and opens the latest page. Company read-only state hides the composer; server enforcement remains authoritative. Drafts are in component memory only and are not preserved across navigation/reload.

`npm.cmd run build --prefix app/client`: exit0,49 modules, built1.85s. This establishes compilation only.

`node scripts/verify-task-comments-browser.mjs`: exit0/PASS, actual headless Edge against local Express/SQLite and built UI. Sign-in/company selection/empty thread, collapse/reopen draft, actual saved201 followed by simulated503 response and unchanged retry (one comment/one audit), literal markup/multiline text, persistence after reload, failed thread-load refresh recovery,26-comment pagination, keyboard disclosure/composer,16 viewport checks at1366/768/375/320 with no document overflow and zero page errors. Final evidence: ignored `tmp/task-comments-browser-pGqHpz/results.json`;375px saved screenshot visually inspected from preceding same-source passing run. First harness run omitted company selection; another error-injection route omitted GET query matching. Both harness issues were corrected; no failed run is counted as passing.

Remaining: comment-specific rate/load acceptance, populated017→018 upgrade preservation, comment backup/restore, moderation/erasure policy, private attachments, milestones, notifications and broader release gates. No deployment/push/external delivery. No claim of full accessibility conformance or real customer validation.


Comment limits and preservation21October2026:30 new comments per author/company per10minute window, persisted hashed bucket, PostgreSQL author lock/SQLite transaction queue; saved retries do not spend another slot. Quota/comment/audit commit together;429 carries remaining Retry-After. Initial standaloneSQLite test exposed missing request-limit initialization; shared idempotent initializer fixed it, final tests pass.

Actual commands: `node --test backend/test/task-comments.test.js` exit0,2/2 PASS (concurrent30th, retry at cap, separate company and exact reset boundary). `node scripts/verify-task-comments-postgres.mjs` exit0/PASS including two-instance quota boundary and existing isolation/audit checks. `npm.cmd run test:all --prefix backend` exit0,122 passed/0 failed/skipped,33279.5955ms; log tmp/comments-limits-backend.log.

`node scripts/verify-task-comments-restore.mjs` exit0/PASS: SQLite017→018 preserves every prior table digest and old checksum (7 populated prior tables), repeat migration no-op; online backup/exclusive restore matches45 table digests and integrity/FKs. Source closed before restored HTTP login/company selection/thread read/retry200/new post201; quota continues1→2. Evidence tmp/task-comments-restore-22dxoC/results.json. Empty finance/AI tables do not prove populated financial recovery; PostgreSQL018 preservation/disaster recovery remains open.

`node scripts/verify-task-comments-browser.mjs` exit0/PASS: actual429 at30 notes preserves draft and leaves30 rows, alongside saved-response-loss retry, reload, paging, keyboard and loading-error recovery;20 viewport checks320–1366 no overflow/zero page errors. Evidence tmp/task-comments-browser-O89YNR/results.json. Client source unchanged since49module build PASS. This is quota acceptance, not production load capacity.

Next: PostgreSQL018 preservation/disaster recovery, broader load/read-traffic controls, moderation/erasure, private attachments, milestones and notifications. No push/deployment/external delivery; full ERP goal remains active.


## PostgreSQL018 upgrade and genuine logical restore —21October2026

`node scripts/verify-task-comments-upgrade-postgres.mjs`: exit0/PASS.017→018 under NOSUPERUSER/NOINHERIT/NOBYPASSRLS migration role preserves25 populated prior tables and all old migration checksums; repeated migration is a no-op. Forced comment RLS, restricted runtime create/read/retry, no-context invisibility and DELETE42501 passed. Prior audit rows remain unchanged; exactly one new comment audit is appended. Evidence: ignored `tmp/task-comments-upgrade/postgres-results.json`.

`node scripts/verify-task-comments-pgdump-restore.mjs`: exit0/PASS. Actual pg_dump18.6 custom archive and pg_restore18.6 single-transaction/exit-on-error restored the local PostgreSQL18.4 application schema into a fresh database.47 table digests/counts match,29 tables populated, including existing sales/time/AI/account security records and comments; empty financial invoice tables do not prove populated invoice-ledger recovery. Source application connections closed before dumping. This is an independent logical archive/restore, not a copied schema fixture.

After digest comparison, the operator reapplied runtime provisioning to a new nonowner credential; startup role/forced-RLS checks passed. Actual restored HTTP login using a fictional non-MFA reviewer, company selection, original task/comment read, new comment201, same-request retry200 and two-row thread passed. No-context comment reads empty; runtime DELETE42501. MFA ciphertext was preserved in the dump; separate MFA-key restore/sign-in remains covered only by earlier SQLite evidence, not this PostgreSQL test. Evidence: ignored `tmp/task-comments-pgdump-qnRhAV/results.json`. No hosted database or production credentials were read.

Client tools were absent from the portable server package. The [PostgreSQL Windows download page](https://www.postgresql.org/download/windows/) directs users to EDB; the [EDB binary archive page](https://www.enterprisedb.com/download-postgresql-binaries) linked version18.6 Windows at https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609. Downloaded through vendor HTTPS to ignored tmp/pg-client-tools, extracted only client bin entries after path-containment validation; no installer/system service or repository dependency change. Archive SHA256 e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2 recorded locally; this is an observed digest, not an independently published/signature-verified checksum. Both tools report18.6. Backup archive hash is in local evidence; archives/keys/binaries are not committed.

This proves a local fixture logical recovery. It does not prove cross-cluster role recreation, external key custody, object storage, hosted restore, production TLS, PITR, recovery-time/recovery-point targets, full financial recovery or load capacity. Last source regression remains122/122 PASS; only verifiers/docs changed this milestone. No push/deployment/external delivery or paid provider call. Full ERP goal remains active.


## Collaboration role and read-only interface21October2026

Read-only company task controls now match the server: assignment form hidden, task status disabled, and create/status handlers also check readOnly. Saved tasks and discussions remain readable. Unassigned company members may see the company-wide project catalog under the existing model; milestone disclosure now explains restricted team access without exposing checkpoint records. This does not change project-catalog permissions. Reports navigation now has a valid current-page value when Subscription is active (removed a stray component-valued aria-current expression).

Actual `npm.cmd run build --prefix app/client`: exit0,50 modules,2.91s. Actual `node scripts/verify-collaboration-roles-browser.mjs`: exit0/PASS in Edge/local Express/SQLite/built UI. Assigned MEMBER recovers a simulated503 list failure through Refresh, reads26 milestones across2pages, has no milestone write controls and posts a real own-task reply. Unassigned peer sees restricted state with0 milestone rows; direct guessed milestone/comment requests404. After fixture subscription expiry, owner retains readable milestones/discussion, has no assignment/comment/milestone composer, and task-status selector is disabled. Direct stale task/milestone writes still return402. Reports/Subscription headings and aria-current states verified.8 viewport checks320/375/768/1366 no document overflow and zero page errors.

Evidence ignored tmp/collaboration-roles-browser-l3o37R/results.json.375px read-only screen visually inspected from preceding same-source collaboration controls run (before the separate navigation-state correction). First harness assumed the shared project catalog itself would be hidden; that incorrect assertion was replaced with actual milestone-data authorization checks. Failed run is not acceptance. Backend unchanged since124/124 PASS; no new backend regression run claimed this interface-only milestone.

Remaining: broader manager/admin variations, company-switch race/session-expiry checks, production load/read controls, private attachments, notifications and other ERP/commercial gates. No hosted migration, deployment, push or external notification. Full goal remains active.
