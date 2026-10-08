# Backend public-demo audit

8 October 2026. Post-event work only. Base eabe5e2, feature/public-demo-readiness. Backend specialist owned backend/src, backend/test and this report; no frontend, shared-state, migration, dependency, private-environment, Git, hosted configuration or public database changes were made.

## Result

Ten concrete correctness/reliability findings repaired. Initial suite: 36 tests PASS; final suite after bounded metadata maintenance: 39 tests PASS, 0 FAIL, exit 0. Tests execute the actual local HTTP login/create/list/detail/logout flow using explicitly injected fixture extraction and isolated in-memory SQLite. A local HTTP provider fixture verifies a stalled response body times out. No paid AI calls were made.

No inspected P0 authentication/RBAC/save defect remains in the local verified flows. Public deployed behavior and live PostgreSQL behavior after these changes remain for the integration owner to verify. QA GATE: UNVERIFIED for the deployed complete application; local backend regression coverage PASS.

## Repaired findings

| Finding / severity | Location | Before and impact | After / verification |
| --- | --- | --- | --- |
| SQLite quota check/increment race, P1 | backend/src/services/requestLimits.js | Read/check and increment were separate SQL statements. A competing request could consume the last slot between them, allowing usage above the configured cap. | One atomic UPSERT with conditional update and RETURNING. Interleaved competing real SQLite statements reject the losing request with 429 and count stays 1. Existing quota/recreation/window HTTP tests pass. |
| Missing PostgreSQL query deadlines, P1 | backend/src/db/postgres.js; backend/src/middleware/errorHandler.js | Only connection acquisition was bounded; blocked statements or stalled query reads had no application deadline. | Pool sets statement_timeout 15000ms and query_timeout 20000ms, retains connectionTimeoutMillis 10000 and verified TLS. SQL cancellation/read timeout maps to generic 503 DATABASE_TIMEOUT without query/credential text. Injected-pool configuration/error tests pass; live server cancellation timing NOT RUN. |
| Failed rollback returns uncertain connection, P1 | backend/src/db/postgres.js | A rollback failure masked the original transaction error and released the connection normally. | Preserve original error and discard the unusable connection on rollback failure. Injected-client regression verifies identity of original error and release(error). Existing atomic-save tests pass. |
| Legacy transcript replay omissions, P1 | backend/src/routes/ai.routes.js | Current LF/CRLF normalization checked LF and legacy CRLF hashes only. Historical CR-only records and exact mixed-ending input missed replay and could spend AI/create another batch. | Check distinct canonical LF, CRLF, CR and exact-original hashes before quota/provider. HTTP regression confirms legacy CR-only submitted as LF and exact mixed-ending input return 200 replayed=true with original IDs and zero provider calls. A differently normalized version of an arbitrary historical mixed-ending digest cannot be reconstructed; this limitation is retained. |
| Calendar year zero mismatch, P1 | backend/src/validators/aiOutput.js | JavaScript accepted 0000-01-01 although PostgreSQL cannot persist that calendar year, producing a later save error rather than correction. Reproduced validDate=true. | Reject year 0000 before save; year 0001 and valid leap days remain accepted. Fixture validation gives 422. |
| Database-incompatible NUL text, P1 | backend/src/validators/aiOutput.js | NUL in task description was accepted; PostgreSQL text cannot store it. Could cause generic persistence failure and SQLite/Postgres inconsistency. | Reject NUL in project name/client/description and task title/description with field-specific 422. Five mutation tests pass, no records saved. |
| Malformed URL returns server error, P2 | backend/src/middleware/errorHandler.js | Authenticated GET /api/projects/%ZZ produced 500. | URI decoding errors now return 400 BAD_PATH with an actionable safe message. Same session still accesses /auth/me after the bad request. |
| Malformed stored password hash throws, P2 | backend/src/services/passwords.js | verifyPassword(password,null) threw TypeError; corrupt stored format could turn login into 500. | Reject non-string/malformed scheme/salt/hash/extra segments without throwing. Valid seeded scrypt credentials still authenticate; wrong password fails. |
| Expired PostgreSQL metadata accumulation, P2 | backend/src/services/postgresSessionStore.js; postgresRequestLimits.js | Expired session rows and obsolete quota buckets were rejected but never pruned. | Existing operations opportunistically schedule at most one 100-row cleanup per minute per store/limiter instance; no timer/service. A captured expiry threshold is rechecked in the outer DELETE predicate so refreshed active rows survive. Cleanup failures do not fail authentication/quota operations and retry after the interval. Real SQL through an isolated adapter fixture verifies bounds, nonblocking behavior, active-row preservation and retry; live PostgreSQL rerun belongs to root. |
| AI timeout lacks distinct recovery feedback, P2 | backend/src/services/aiService.js | Timeout/abort was indistinguishable from generic provider failure (502). | TimeoutError/AbortError return 504 AI_TIMEOUT and explicitly say no records were saved. Actual local stalled HTTP response-body test confirms timeout; no external call. |

Each repaired failure path has focused regression coverage.

## Additional verified boundaries

- All ten supplied users authenticate and receive exactly permitted project/task IDs. Managers cannot fetch other project details; agents receive only own task rows in permitted details.
- Login regenerates the session ID; switching admin to Ali invalidates the old admin cookie. Logout invalidates the active session.
- Existing tests exercise unauthenticated requests, role/user-ID parameter spoofing, non-admin creation, repeat clicks, async quota race, LF/CRLF replay, malformed JSON, rejected origin, provider failure, unknown employee/wrong role, invalid dates/hours, required descriptions, rollback, restart persistence, seed idempotency and secure HTTPS-proxy cookies.
- Database/provider error text stays sanitized. Password/session fields are excluded from AI directory payloads. SQL values remain parameterized; directory/read-only endpoints do not expose password hashes.
- SQLite synchronous contracts remain supported; PostgreSQL services retain async queries, one checked-out transaction client and advisory-hash save lock. Provider calls remain outside database transactions.

## Remaining limits and configuration findings (read-only)

1. **Distributed provider invocation:** inFlight is per application instance. Two instances may pay for the same transcript concurrently; PostgreSQL advisory transaction lock still ensures one saved batch, and atomic shared AI quota bounds usage. A cross-instance extraction claim needs deliberate coordination/lifecycle design; no facade or extra service was introduced.
2. **Metadata maintenance scope:** PostgreSQL cleanup is opportunistic, bounded and per instance; an idle deployment does not run maintenance, and a large backlog drains across later operations. SQL touches only expired sessions/quota buckets, never business records. Newly cold instances may each run one bounded batch. No timer or external maintenance service exists.
3. **Privileged runtime connection:** source accepts the configured database connection; migration enables private-schema RLS/revokes browser-role access, but runtime currently depends on a schema-owner-capable connection when auto-migrate is enabled. Root should retain hosted DATABASE_AUTO_MIGRATE=0 and plan a separate least-privilege runtime role before treating this as production tenant software. No credential value or actual role was read/printed here.
4. **Public demo credentials:** shared fictional accounts intentionally permit anyone to act as demo admin. This is a demonstration access model, not private business authentication. Login throttling targets failed attempts; successful known demo logins reset that bucket. Global paid-AI quota limits provider usage, not every possible request.
5. **Model semantic correctness:** server validates shape, references, dates, required text and positive hours; it cannot prove an AI selected the final conversational decision for arbitrary meetings. Root must preserve original/modified/unseen input evidence. Fixture-provider tests are not live AI proof.
6. **Long/complex extraction:** provider output limit is 6000 tokens; transcript ceiling 100000 characters. Truncation is detected and saves nothing, but maximum-length meetings are not guaranteed to extract successfully. No hardcoded official-answer fallback exists.
7. **Operational limits:** backend still imports experimental Node SQLite support for local mode; verified current runtime is Node 24. Unsupported runtime versions, live hosting outages and full load behavior were not validated by these local tests.

## Evidence and sources

- Pre-fix isolated probes: year0000Accepted=true; malformedHashThrows=true; malformedPathStatus=500; acceptedNullByteDescription=true.
- `node --test backend/test/public-audit.test.js`: 9/9 PASS, exit 0.
- `node --test backend/test/postgres-config.test.js`: 4/4 PASS, exit 0 after fixture configuration isolated from private CA-file settings.
- Final `npm.cmd run test:all` in backend: 39/39 PASS, exit 0.
- `git diff --check -- backend/src backend/test backend/scripts`: PASS before final report; integration owner can repeat for combined changes.
- Primary PostgreSQL docs confirm NUL cannot be stored in character types: https://www.postgresql.org/docs/current/datatype-character.html
- Primary node-postgres client docs and installed pg 8.16.3 source confirm statement_timeout/query_timeout: https://node-postgres.com/apis/client

## Handoff

Changed: backend/src/db/postgres.js, middleware/errorHandler.js, routes/ai.routes.js, services/aiService.js, services/passwords.js, services/requestLimits.js, validators/aiOutput.js; backend/test/postgres-config.test.js; NEW backend/test/public-audit.test.js. Additional maintenance files: backend/src/services/postgresSessionStore.js, backend/src/services/postgresRequestLimits.js and NEW backend/test/postgres-maintenance.test.js. No backend scripts were modified. Root owns combined build, public/PostgreSQL smoke, deployment, Git integration, recording and operational-state updates.
