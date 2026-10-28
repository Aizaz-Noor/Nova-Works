# Account security history local acceptance

Migration015 adds an account-owned event ledger for successful password changes and recovery resets. Records contain only a generated ID, account reference, event type and server timestamp. No password, credential stamp/hash, reset token, IP address or user agent is recorded. Earlier activity is not backfilled or reconstructed. This is not a complete login/device audit.

The credential update and event insert share one transaction. Recovery token consumption is in that same transaction. If history insertion fails, the password and token state roll back. Recovery resets never automatically sign in. Existing credential-bound sessions remain invalid after a successful credential change.

Authenticated `GET /api/v1/account/security-events?page=1` lists only the requesting account, across its companies. It accepts no user/company selector. Pagination returns20records per page. Forced PostgreSQL RLS restricts reads/inserts to the trusted user context; runtime receives SELECT/INSERT only. SQLite guards prohibit rewriting/deleting events. Account security UI fetches history when opened, with loading, empty, error, refresh and paging states. Timestamps are labeled UTC.

## Evidence

- Full backend `npm.cmd run test:all`:110/110 PASS exit0. Final focused history check PASS, including22fixtureevents split20+2 and other account empty.
- SQLite recovery history insertion failure preserves original credentials/unconsumed token; immutable event update/delete rejected.
- `node scripts/verify-security-history-postgres.mjs`: PASS exit0. Actual restricted HTTP self history, foreign account empty, selector400, no-context RLS invisible, update/delete42501; injected history failure rolls back password/token, then the same token works after restoring event insertion.
- Client build47modules PASS exit0. Edge changes password, signs in afresh and renders the recorded event. Eight viewport checks1366/768/375/320 PASS/nooverflow/zero pageerrors;375px history visually inspected.
- `node scripts/verify-security-history-upgrade-postgres.mjs`: PASS exit0. NOSUPERUSER/NOBYPASSRLS migration role preserves21populatedprior tables and002-014checksums, forced new RLS and repeat migration. Recovery expiry index added without changing014.
- Fresh34trackedtable restore matches all digests, integrity and foreign keys. User/company/security history populated; finance and delivery empty in this fixture.

## Operation and remaining requirements

Apply015 using the migration credential, reapply runtime provisioning, then start the application with its restricted role. Startup refuses missing forced security/recovery policies. PostgreSQL migration owner needs ownership of the existing recovery-token table to create its expiry index, as verified by the upgrade check.

Only local fictional accounts/databases were used. No push, deployment, external message or paid call. MFA/step-up, verification delivery, live recovery acceptance, login/device event coverage, notifications, history retention/erasure policy, production retention CLI TLS acceptance and the full ERP release plan remain open.
