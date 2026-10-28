# MFA implementation in progress

Current implementation includes durable factor services, login/session enforcement, authenticated enrollment/management APIs and Account security UI. These have been exercised only with local fixtures; no live accounts or deployment were activated. Existing-data upgrades, encrypted/key restore and remaining release acceptance are still required.

TOTP follows RFC6238 with a30second counter and6digits for authenticator use. Verification accepts only exact6digit strings in the previous/current/next window and returns a counter strictly newer than the persisted replay counter. The next service must lock the enrolled factor and atomically persist the returned counter. Computing a valid code alone is not an authorization decision.

Secrets are encrypted with AES256GCM using independent random96bit nonces and a32byte server key. Authenticated data binds the user, purpose, format version and key ID. An explicit keyring permits reading retained old keys while new writes use the active key; old keys cannot be removed until affected secrets/backups are migrated. There is no production key in source and no default key derived from SESSION_SECRET. Key persistence, rotation, backup and restore acceptance remain required.

## Component evidence

`node --test backend/test/mfa-crypto.test.js`:3/3 PASS exit0. Tests cover all18RFC6238AppendixB vectors across SHA1/SHA256/SHA512, future64bit counters, strict code/base32 handling, replay-counter boundary, tampering, account substitution, format version and retained old key support. These are component tests, not browser/authenticator or complete login proof.

## Required integration

1. Durable account factor state, encrypted pending enrollment with expiry, factor generation/session epoch, atomic replay counter and hashed single-use recovery codes. Forced self RLS and reviewed global authentication lookup must fail closed without exposing secrets.
2. Current-password reauthentication for enrollment; a valid authenticator code confirms setup. Active factors cannot be silently replaced by starting another setup.
3. Login requires password and enrolled factor proof before issuing an authorized session. Failed/pending challenges get no business access. Missing encryption keys must block enrolled accounts rather than falling back to passwords.
4. MFA enrollment/disable/rotation invalidates older sessions through a factor epoch. Existing credential-bound checks remain. Password recovery changes only the password and must not disable MFA or mark it satisfied.
5. Factor reset/disable needs current proof or a single-use recovery code with reauthentication; email alone cannot remove the second factor. Recovery codes are generated securely, shown once, hashed in storage and consumed atomically.
6. Sensitive administrative operations require recent reauthentication. Integrate clear client challenges, bounded attempts, cancel/retry/expiry, security history and keyboard/mobile verification.
7. Verify restrictedPostgreSQL races/RLS/restart, migrations preserving data, encrypted backup restore with separately retained keys, browser flow and actual authenticator interoperability before activation.

TOTP is not phishing-resistant. Passkeys or an appropriately configured identity provider remain stronger future options; no compliance or production readiness claim is made.

Sources: [RFC6238](https://www.rfc-editor.org/rfc/rfc6238) and [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Durable service progress

Migration016 defines self-scoped forced-RLS factors and recovery-code rows. Pending setup is encrypted, expires after10minutes and is invalidated by a credential change. Current-password verification is required for starting/confirming setup and disabling a factor. Active factors cannot be overwritten by starting a new setup. Confirmation generates10random128bit recovery codes, stores only account/epoch-bound digests and returns the raw codes once. TOTP counters and recovery-code consumption are serialized by account within a transaction. Failed proof counts commit before the error is returned; five failures impose a15minute block. Disabling with valid password and factor proof rotates the account epoch. Password recovery leaves the factor and epoch intact.

Focused MFA tests5/5 and full backend115/115 PASS exit0. Tests cover credential-stale/expired pending setup, concurrent TOTP replay, one-use recovery codes, lockout, missing/wrong encryption key, encrypted storage, disabled epoch and password-recovery preservation. Restricted PostgreSQL verifier has been prepared but could not connect because the local cluster was stopped; foreground recovery is tracked in RUN_STATE. No PostgreSQL MFA PASS is claimed.

Runtime grants and startup checks require both forced MFA policies. Later sections record the locally implemented routes, login/session checks, enrollment/management UI, audit and key configuration. Preservation upgrades, encrypted restore/key acceptance and real authenticator interoperability remain pending.

## Login/session integration evidence

The password login verifies enrolled factor proof before issuing an authorized session. TOTP and recovery proofs consume atomically; missing/wrong proof produces no new account authorization. Sessions carry the verified factor epoch; enabling/disabling changes invalidate older sessions. Missing encryption configuration fails closed for enrolled sessions/logins. Password recovery does not remove or satisfy MFA. Legacy demo mode checks an installed factor ledger too, preventing a server-mode downgrade bypass. A truly pre-MFA legacy schema may run without factors; an applied016 marker with a missing factor ledger fails closed.

MFA_KEYRING_JSON is optional private JSON with activeKeyId and a keys map of canonical base64-encoded32byte keys. Malformed explicit configuration fails startup without echoing values. No key is generated implicitly or derived from session secrets. Keep key backups separate from database backups.

Observed: focused HTTP/config2/2 and full backend117/117 PASS exit0; client build47modules PASS. Actual restricted PostgreSQL service verifies concurrent TOTP and recovery-code one-use behavior, encrypted/hash-only ledger, self/no-context RLS and denied DELETE. Actual PostgreSQL HTTP verifies stale sessions, required factor proof, replay, missing configuration, legacy-mode protection, password recovery preserving MFA and disable epoch rotation. Browser code challenge and business401before/200after proof PASS at1366/768/375/320 with no overflow/pageerrors;375px visually inspected. Fixture enrollment and clock/codes were generated by test code, not a real authenticator or public enrollment API.

Still pending: preservation upgrades, encrypted backup restore, key rotation/restore and actual authenticator interoperability; later management evidence covers the implemented routes, UI, history and initial recent-proof scope. Do not equate these passing authentication checks with the full ERP launch gate.

## Management and recent-proof progress

Authenticated endpoints support setup, confirmation, recovery-code regeneration, explicit disable and reauthentication. Responses containing setup keys/codes use no-store. Current password is required; enrolled factor operations additionally consume an unused TOTP or recovery code. Confirmation/regeneration returns raw recovery codes once, rotates factor epoch and renews the current session using the credential stamp verified inside the operation. Older sessions lose access. The existing company selection is retained. No credential stamp or epoch is returned in management responses.

Migration017 adds a separate immutable MFA event ledger, merged into private account history. Event insertion shares the factor/code transaction, including backup-code use. An audit failure rolls back factor generation and consumed proof. A per-account sequence orders same-timestamp MFA events without altering their recorded timestamps. Previously committed015history SQL remains unchanged.

A five-minute server-side reauthentication window guards company settings, invitations, subscription-binding commands and password changes. Enrolled accounts need both recent primary and factor proof. Non-enrolled accounts can reauthenticate with current password even when setup encryption is unconfigured. This is an initial sensitive-action scope, not proof that every future privileged workflow is covered. Independent IP/account action quotas and failed-factor limits persist across requests.

The UI supports manual authenticator key entry, confirmation, one-time code display/acknowledgement, regeneration, reauthentication and explicit disable. Raw setup/recovery values live only in component memory and delivery responses, not browser storage or history events. A lost confirmation/regeneration response may require signing in with the authenticator and creating a fresh code set; raw codes are not replayed.

Observed: focused service/HTTP/audit rollback/sequence checks PASS, restricted PostgreSQL management HTTP/old-session revocation/quota/step-up/audit rollback PASS. Browser management16viewportchecks PASS with no overflow/pageerrors, including setup/regeneration/reauthentication/disable and ordered history;375px inspected. TOTP was simulated from the displayed key by the fixture, not an actual phone authenticator. Client build48modules PASS. Earlier full suite119/119 PASS; final rerun recorded in RUN_STATE.

Still pending:016/017 preservation upgrades, encrypted37-table restore with separate key material, key rotation/restore, real authenticator interoperability, review of remaining privileged action coverage, production transport/provider verification and broader ERP/commercial gates. No deployment, push, external message or paid provider call.

Final regression after management/order/password-guard changes:119/119 PASS exit0; final client build48modules PASS. No checkpoint commit or deployment yet.


## Preservation, encrypted restore and key rotation acceptance

21 October 2026: `verify-mfa-upgrade-postgres.mjs` PASS on local PostgreSQL18 with a NOSUPERUSER/NOINHERIT/NOBYPASSRLS migration role. Upgrade015→016 preserved22 populated prior tables;016→017 preserved24. Prior migration checksums, existing history and factor epoch were preserved; repeat migration was a no-op, forced RLS remained enabled and runtime event deletion returned42501. No historical enrollment event was fabricated.

`verify-mfa-restore.mjs` PASS: a fresh SQLite restore matched all37 tracked table digests and passed integrity/foreign-key checks. Fixtures populated an account, company, membership, project, task, customer, quotation/items and MFA; financial tables were empty. Separately retained ignored fixture keys restored actual HTTP password-plus-TOTP login. This is local fixture evidence, not production vault or PostgreSQL disaster-recovery acceptance.

Successful TOTP proof now re-encrypts the active secret with the configured write key in the same transaction as counter consumption. Pending setup confirmation also uses that write key. Replay/invalid proof does not rotate ciphertext. Encryption-only rotation preserves factor epoch, enabled time, sessions and backup codes. Subsequent TOTP login with only the new key passed. Older database backups still require their old key. A valid backup code does not decrypt the TOTP secret and does not rewrap it; missing the old reader key blocks old-secret TOTP proof, not necessarily backup-code proof when a cipher is configured.

Evidence: `tmp/mfa-upgrade/results.json` and `tmp/mfa-restore-ZMz5sd/results.json` (ignored local fixtures). Focused service tests4/4 PASS including key rotation. Prior actual Edge management16viewport checks and client48module build PASS. Remaining launch acceptance includes an actual authenticator app, production key custody/rotation/transport, broader privileged-action review, hosted staging and all other open ERP gates. No push, deployment, email or paid provider call performed.


MFA checkpoint21October2026: `npm.cmd run test:all --prefix backend` completed exit0,120 tests passed/0 failed/0 skipped (47456.691ms); terminal output retained in ignored `tmp/mfa-final-backend.log`. `node scripts/verify-mfa-upgrade-postgres.mjs` exit0/PASS preserved22/24 populated prior tables across015→016→017 with unchanged old checksums. `node scripts/verify-mfa-restore.mjs` exit0/PASS matched37 table digests, restored HTTP password+TOTP login with separately retained fixture keys, rewrapped live secret to next key without epoch change, and verified backup-code single use. These exercise behavior beyond compilation. Actual Edge management16viewport and client48module build evidence remains as previously recorded. Actual phone authenticator, production key custody, PostgreSQL disaster recovery and other ERP launch gates remain OPEN; no push/deployment/external delivery.
