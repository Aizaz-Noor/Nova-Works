# Task-comment notifications — isolated next candidate

22October2026. Branch codex/erp-notifications, separate checkout tmp/novaworks-next-notifications; base69e6e3b. Human-testing candidate on3039 remains unchanged.

Migration020 adds private recipient/task-scoped notifications with composite comment/task/company and membership foreign keys. New comments notify the current task assignee/project manager, deduplicated and excluding the author. Comment, quota, audit and notifications commit together; retries emit no duplicate events. No comment body is copied into notifications. Current task permissions are checked again when listing/acknowledging; reassignment hides prior recipient records. No external delivery.

GET /api/v1/notifications supports bounded page/limit; POST /api/v1/notifications/:id/read accepts an empty object, preserves original read timestamp on repeats and works while company business writes are read-only. Forced recipient/task RLS; runtime UPDATE(read_at) only, no DELETE; SQLite payload guards. Historical comments do not produce retrospective notifications.

Actual `node --test backend/test/task-notifications.test.js`: exit0,1/1 PASS including actual HTTP/CSRF and recipient/reassignment/rollback. Initial run exposed inconsistent SQLite row prototype on repeat acknowledgement; normalized return and reran PASS. `node scripts/verify-task-notifications-postgres.mjs`: exit0/PASS on local restricted PostgreSQL role: private rows, atomic fanout/retry, payload UPDATE/DELETE42501, notification failure rolls back comment, read-only acknowledgement and business402, reassignment404. `npm.cmd run test:all --prefix backend`: final exit0,125 passed/0 failed/skipped,35445.8369ms (tmp/notifications-backend-final.log). Earlier failing run not counted as acceptance.

Still open: notification interface/browser,020 populated upgrade and restore, broader event types/retention and release gates. Not integrated into the human-testing candidate, deployed or pushed. Full ERP/commercial objective incomplete.


Interface follow-up22October2026: Notifications.jsx/css integrated into selected-company workspace. Actual Edge browser21events/paging/lazy/readcounts/read-onlyack/accesswithdrawal and12responsive checks PASSexit0; tmp/notifications-browser-bnxf7L/results.json. Final client53modulebuildexit0. Upgrade/restore and broaderstates remainopen; originalhuman-testsiteunchanged. See PREMIUM_REPORTS_ACCEPTANCE.md.

## Populated upgrade and genuine restore — 22 October 2026

Actual `node scripts/verify-notifications-upgrade-postgres.mjs`: PASS, exit 0. Upgrade019→020 preserved27 populated prior tables and historical migration checksums; repeat migration was a no-op. Restricted runtime notification generation/retry, recipient isolation, absent context and forbidden DELETE were verified. Evidence: tmp/notifications-upgrade/postgres-results.json.

Migration privilege requirement:020 creates an index on existing platform_task_comments. GRANT ALL alone failed42501; the migration role must own that table (or have appropriate owner authority). Fixture explicitly transfers that table to a NOSUPERUSER/NOINHERIT/NOBYPASSRLS migrator. Application runtime remains a restricted nonowner. Verify hosted migration ownership before rollout.

Actual `node scripts/verify-notifications-pgdump-restore.mjs`: PASS, exit0. Genuine local PostgreSQL18.6 dump/restore matched all49 application tables/counts/digests,31 populated. Fresh restricted runtime passed restored HTTP login/company selection/inbox/read-repeat/comment201/retry200; exactly one additional notification. Evidence: tmp/notifications-pgdump-zNBz18/results.json. Local nonTLS fixtures do not prove hosted/cross-cluster recovery or operational RTO/RPO. Historical open upgrade/restore items above are superseded for these local checks only.
