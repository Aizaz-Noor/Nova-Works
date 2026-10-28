# Local account recovery acceptance

Recovery uses a256-bit random bearer token, stores only its SHA256 digest and credential fingerprint, expires it after30minutes, and consumes it atomically with the password change. Credential changes invalidate outstanding links. Reset never signs the user in; existing credential-bound sessions lose access on their next request.

The request and reset APIs require trusted Origin and JSON. Separate persisted IP and identity quotas bound requests and guesses. Known and unknown addresses receive the same202 accepted response. A300ms minimum request duration is a partial timing mitigation, not proof of timing indistinguishability. Server-injected delivery has a5second deadline; failures invalidate the token. Late delivery therefore cannot restore a failed token. No raw token is returned in API responses or stored in the ledger.

The client accepts links as `/#recovery=<token>` and removes the fragment immediately. Tokens are not accepted from query parameters. A confirmation mismatch prevents submission. Success returns the user to sign-in; used/expired links show a recoverable error. Recovery request UI appears only when the server reports configured delivery. Default server startup has no delivery adapter and no live email capability.

## Observed evidence

- Focused ledger and HTTP tests pass for single-use concurrent redemption, expiry, credential changes, uniform accepted responses, CSRF, session revocation and limits.
- Final full backend108/108 PASS exit0, including startup-policy changes.
- `node scripts/verify-account-recovery-postgres.mjs`: PASS exit0, actual restricted runtime HTTP flow, forced ledger RLS/no-context invisibility, denied DELETE42501. Global identity ledger is not a company business table; scoped user/token policies protect access.
- `node scripts/verify-recovery-upgrade-postgres.mjs`: PASS exit0, NOSUPERUSER/NOBYPASSRLS014 upgrade preserves20populatedprior tables and002-013checksums; forced recovery RLS and repeat migration verified.
- Client build46modules PASS exit0. Edge browser request/reset/newlogin/usedlink denial and12viewport checks at1366/768/375/320 PASS/nooverflow/zeroerrors.375px form visually inspected.
- Fresh33trackedtable SQLite restore matches digests and passes integrity/foreign keys. User/token populated; business tables empty in this fixture.

## Activation boundary and remaining work

The only delivery used was an in-process local fixture. No actual email, provider API call, hosted migration, push or deployment occurred. Runtime provisioning must be reapplied after014migration; startup refuses missing forced recovery policy. Live delivery requires a reviewed adapter, bounded queue/transport behavior, trusted fixed link origin, provider configuration and explicit external-send authorization. Do not present the fixture as inbox delivery.

Retention and operator cleanup, security event history, verified-email onboarding, MFA/step-up, provider acceptance and broader release security testing remain unfinished. A300ms floor cannot hide an arbitrarily slow known-account delivery adapter; production activation requires delivery architecture and timing/load verification. The full ERP launch plan remains active.
