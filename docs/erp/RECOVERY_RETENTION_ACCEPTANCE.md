# Recovery token retention operator

The separate operator command previews by default. APPLY removes at most the configured batch of tokens whose expiry is older than the configured7-365day retention period. Default batch100; accepted range1-1000. Current/recent tokens, users, sessions and business records are not deletion targets. The database policy enforces a minimum7days after expiry even if a cutoff is misconfigured. Concurrent apply transactions serialize on a retention advisory lock. Preview counts only the eligible batch, not the whole backlog.

## Operation

Review and provision a separate role using backend/scripts/provision-recovery-retention.sql with retention_role. It has SELECT/DELETE on the recovery ledger, no token rewrite or business-table access, no membership, elevated role attributes, ownership or permanent DDL. The application role is rejected. Credentials stay in a private operator environment, never source or chat. No runtime credential gains DELETE.

Run `npm run recovery:prune` with ERP_ENABLED=1, RECOVERY_RETENTION_ENABLED=1 and a dedicated DATABASE_URL. RECOVERY_RETENTION_MODE defaults PREVIEW; set APPLY explicitly only for the reviewed batch. RECOVERY_RETENTION_DAYS defaults7 and RECOVERY_RETENTION_BATCH defaults100. Each run reports cutoff, eligible batch and deleted count without user identifiers, token values or token hashes. No recurring job was installed. This is a recommended engineering default, not a finalized legal data-retention policy.

## Evidence

- Focused SQLite retention test1/1 PASS exit0: preview retains all rows, bounded deletion, replay/no remaining work, user preserved and recent token still redeems.
- `node scripts/verify-recovery-retention-postgres.mjs`: PASS exit0. Actual separate NOSUPERUSER/NOBYPASSRLS role provisions idempotently; application-role reuse refused; business read/token rewrite/application DELETE denied42501. Preview preserves4rows; apply deletes2+1+0. An overbroad future cutoff cannot delete the recent row; its token still resets the password.
- Full backend `npm.cmd run test:all`:109/109 PASS exit0.
- Disabled CLI child-process smoke: expected exit1 before database connection. `git diff --check`: exit0.

Only disposable local test records were removed. CLI production TLS transport has not been verified end-to-end: the actual local PostgreSQL service verifier uses the existing non-TLS fixture adapter. The production TLS database client was preserved. No hosted deletion, schema migration, schedule, email, push or deployment performed. Large-backlog performance and automated operation remain unverified. Security history, live recovery delivery/acceptance, verified-email onboarding, MFA and the remaining ERP launch plan remain open.
