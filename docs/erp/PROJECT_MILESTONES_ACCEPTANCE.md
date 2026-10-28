# Project milestones — backend acceptance

21 October2026. Implements the dated delivery checkpoints in the original collaboration roadmap. Interface, reminders and notifications are not implemented yet.

Migration019 adds project/company and creator/company composite foreign keys, title/description bounds, OPEN/DONE/CANCELLED state, completion-time consistency, version and due-date index. Each author/company request UUID is unique; an immutable creation digest allows an unchanged creation retry to resolve to the current record even after later edits. Changed creation contents for the same request return409. No delete endpoint is exposed; PostgreSQL runtime grants SELECT/INSERT/UPDATE only.

Endpoints: GET/POST `/api/v1/projects/:id/milestones` and PATCH `/api/v1/projects/:id/milestones/:milestoneId`.25-row default/100maximum pagination, date/ID ordering and snapshot count/list. Creation requires title, real dueDate and requestId UUID; description optional. Date cannot exceed the current project deadline. Owner/admin or that project's manager can create/update. A MEMBER can read only if currently assigned a task in the project; company/project member roles remain the existing model, not the future granular permission system.

Updates require current integer version; database compare-and-swap prevents lost writes. Completion sets completed_at; cancellation/reopening clears it. History is retained through audit events; this does not yet provide a full per-field timeline or notification. Strict supported bodies, existing Origin/JSON gates, projects subscription entitlement/read-only controls and forced task/project-scoped RLS apply. Milestone changes and audit commit together.

## Actual verification

- `node --test backend/test/project-milestones.test.js backend/test/runtime-startup.test.js`: exit0,2/2 PASS. Scoped reads/manager writes, real deadline validation, retry after update, same-version race, completion/cancellation/reopen, null rejection, audit rollback and actual HTTP login/company selection/create201/retry200/update200/stale409/hostile-Origin403.
- `node scripts/verify-project-milestones-postgres.mjs`: exit0/PASS on disposable loopback PostgreSQL18.4. Restricted nonowner runtime/forcedRLS, assigned-member read1 versus peer/foreign/no-context0, independent-service create dedup and version race, member direct UPDATE0/runtime DELETE42501, audit-failure rollback. Evidence ignored `tmp/project-milestones/postgres-results.json`; local nonTLS fixture transport, not production acceptance.
- `npm.cmd run test:all --prefix backend`: exit0,123 passed/0 failed/skipped,28744.7201ms. Log ignored `tmp/milestones-backend.log`.
- `git diff --check`: exit0.

Next: interface/browser, migration018→019 preservation, milestone backup/restore, creation abuse limits/load checks and remaining collaboration work. Client source unchanged this milestone; no new client build or browser PASS claimed. No hosted migration, push, deployment, external notification or paid provider call. Full ERP/commercial launch remains active/incomplete.


## Milestone interface and conflict recovery21October2026

Inline project disclosure loads milestones on first opening and retains unsent edits across collapse/reopen. Managers can create dated checkpoints and edit title/description/date/state; assigned members read checkpoints without write controls. Company read-only state hides the editor. Drafts stay only in component memory, not across navigation/reload. Creation keeps the request UUID for an unchanged retry after an uncertain response.

A stale update preserves draft fields and disables save. The new scoped GET `/api/v1/projects/:id/milestones/:milestoneId` supplies current values for review. The user explicitly chooses to retain their draft against the reviewed version, then saves; a further concurrent change still returns409. No automatic overwrite. This adds checkpoint editing, not automatic reminders or notifications.

Actual results: `npm.cmd run build --prefix app/client` exit0,50 modules,2.53s. `npm.cmd run test:all --prefix backend` exit0,123 passed/0 failed/skipped,51612.9524ms; log tmp/milestones-ui-backend.log. `node scripts/verify-project-milestones-postgres.mjs` exit0/PASS including newly scoped individual read (assigned member succeeds/peer404), prior RLS, races and audit rollback.

`node scripts/verify-project-milestones-browser.mjs` exit0/PASS in actual headless Edge/local Express/SQLite/built app: sign-in/company/project, empty/add form and initial input focus, actual saved201 followed by simulated503 retains draft, retry yields one milestone, concurrent409 preserves edit, GET latest plus explicit reviewed-version retry savesversion3, DONEversion4 completion timestamp and reload persistence.12 viewport checks320/375/768/1366 no overflow/zero page errors;375px conflict screenshot visually inspected. Evidence tmp/project-milestones-browser-fmd8CI/results.json (ignored). Earlier browser attempts failed to find the status selector because its wrapping label included option text; explicit separate label/control corrected it and the final run passed. No failed run counted as acceptance.

Next:019 populated upgrade and milestone backup/restore, abuse/load controls, browser member/read-only/paging/error coverage, remaining collaboration and launch gates. No push/deployment/external notifications or paid call. Full ERP launch remains active/incomplete.


## Milestone upgrade/recovery and write quotas21October2026

`node scripts/verify-project-milestones-upgrade-postgres.mjs`: exit0/PASS,018→019 under NOSUPERUSER/NOINHERIT/NOBYPASSRLS migration role.26 populated prior tables and old migration checksums preserved, repeat no-op, forced milestone RLS, restricted runtime create/read/complete/retry and no-context/DELETE42501 checks. Existing task discussion and account/MFA history included. Evidence ignored tmp/project-milestones-upgrade/postgres-results.json.

`node scripts/verify-project-milestones-pgdump-restore.mjs`: exit0/PASS with real pg_dump18.6/pg_restore18.6, local PostgreSQL18.4 source and fresh target.48 application table counts/digests match before runtime reprovisioning,30 populated tables. Newly provisioned restricted role passed startup assertions; actual restored HTTP login/company selection/completed milestone read/reopen200/stale409/scopedGET/new201/retry200 passed; DELETE42501. Quota ledger also preserved in matched snapshot. Evidence ignored tmp/project-milestones-pgdump-BHDlqg/results.json. This remains local same-cluster logical recovery: hosted/cross-cluster roles, MFA key custody, object storage, populated invoice-ledger recovery, PITR and RTO/RPO acceptance remain open.

Milestone writes now use persisted hashed author/company buckets:30 new checkpoints and120 successful updates per10minute window. Unchanged saved creation retries are exempt. Quota and business/audit changes share a transaction; failure rolls back a slot. PostgreSQL locks the bucket across instances; SQLite uses the shared transaction queue.429 includes remaining Retry-After. Shared helper is internal; limits are engineering safeguards, not a purchased plan or proof of production capacity.

`node --test backend/test/project-milestones.test.js`: exit0,2/2 PASS including separate service instances, concurrent creation boundary, saved retry exemption,120-update cap, persisted version and exact reset boundary. `node scripts/verify-project-milestones-postgres.mjs`: exit0/PASS including two-service30th-creation boundary plus prior RLS/race/rollback checks. `npm.cmd run test:all --prefix backend`: exit0,124 passed/0 failed/skipped,41349.2586ms; log tmp/milestones-recovery-backend.log.

`node scripts/verify-project-milestones-browser.mjs`: exit0/PASS actual Edge against unchanged built50module UI and updated backend. Actual creation429 preserves unsent checkpoint and leaves30 rows; prior creation lost-response retry,409 review/rebase,completion/reload checks pass.16 viewport checks320–1366 no overflow/zero page errors. Evidence tmp/project-milestones-browser-bnUs0e/results.json. No client source changed since final2.53s successful build. Quota checks are not load benchmarks.

Next: remaining role/read-only/paging/loading-error browser coverage, broader load/read controls, private attachments, notifications and remaining ERP/launch gates. No remote push, deployment, external notifications or paid provider call. Full goal remains active.


## Collaboration role and read-only interface21October2026

Read-only company task controls now match the server: assignment form hidden, task status disabled, and create/status handlers also check readOnly. Saved tasks and discussions remain readable. Unassigned company members may see the company-wide project catalog under the existing model; milestone disclosure now explains restricted team access without exposing checkpoint records. This does not change project-catalog permissions. Reports navigation now has a valid current-page value when Subscription is active (removed a stray component-valued aria-current expression).

Actual `npm.cmd run build --prefix app/client`: exit0,50 modules,2.91s. Actual `node scripts/verify-collaboration-roles-browser.mjs`: exit0/PASS in Edge/local Express/SQLite/built UI. Assigned MEMBER recovers a simulated503 list failure through Refresh, reads26 milestones across2pages, has no milestone write controls and posts a real own-task reply. Unassigned peer sees restricted state with0 milestone rows; direct guessed milestone/comment requests404. After fixture subscription expiry, owner retains readable milestones/discussion, has no assignment/comment/milestone composer, and task-status selector is disabled. Direct stale task/milestone writes still return402. Reports/Subscription headings and aria-current states verified.8 viewport checks320/375/768/1366 no document overflow and zero page errors.

Evidence ignored tmp/collaboration-roles-browser-l3o37R/results.json.375px read-only screen visually inspected from preceding same-source collaboration controls run (before the separate navigation-state correction). First harness assumed the shared project catalog itself would be hidden; that incorrect assertion was replaced with actual milestone-data authorization checks. Failed run is not acceptance. Backend unchanged since124/124 PASS; no new backend regression run claimed this interface-only milestone.

Remaining: broader manager/admin variations, company-switch race/session-expiry checks, production load/read controls, private attachments, notifications and other ERP/commercial gates. No hosted migration, deployment, push or external notification. Full goal remains active.
