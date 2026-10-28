# Password change and credential-bound sessions

Authenticated accounts may change their password with current-password verification. The endpoint requires the trusted Origin and JSON,12-128character different new password, bounded failure attempts and atomic old-hash comparison. Public demo accounts cannot change shared credentials. The form confirms the new password, retains recoverable errors and signs out after success.

Sessions carry a server-only SHA256 fingerprint of the stored salted password hash. Every authenticated request compares it with the current credential. A password change therefore invalidates existing sessions on their next request, even if an old session row is later written back. Pre-upgrade sessions have no fingerprint and require a fresh login. Already-authorized in-flight business requests are not canceled by this check. All serving instances must run the updated authentication middleware before activation.

## Operation and evidence

Reapply reviewed backend/scripts/provision-runtime.sql before enabling password changes in PostgreSQL. It adds UPDATE(password_hash), not UPDATE on role/profile columns. There is no schema migration. Test-only databases use loopback PostgreSQL; no hosted change performed.

- node --test backend/test/account-security.test.js: actual HTTP reauthentication/CSRF/two-session invalidation/old-password denial/new-login acceptance. Restored-session regression PASS exit0: old persisted session rows cannot revive access.
- node scripts/verify-account-security-postgres.mjs: PASS exit0, restricted role actual HTTP flow and denied role-column UPDATE42501.
- Bundled Edge verifier node scripts/verify-account-security-browser.mjs: PASS exit0, wrong-password error retained form, successful sign-out, subsequent401. Four1366/768/375/320viewport checks without horizontal overflow or uncaught errors.375px form visually inspected.
- Client npm.cmd run build: PASS exit0,45modules. Final full backend suite106/106 PASS exit0 including limiter/restored-session changes.

## Remaining requirements

This is password change for an authenticated user, not forgotten-password recovery or MFA. Verification delivery, reset tokens, MFA/step-up, security event history, session/device administration, notifications and full release security review remain open. No email, deployment, push or paid provider call performed.

A later PostgreSQL rerun could not run while the existing local cluster performed crash recovery (57P03); the preceding PostgreSQL PASS remains explicitly prior evidence. The active recovery process was preserved. No hosted database accessed.
