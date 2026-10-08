Current adaptive UI and replacement88-second media are documented in [RESPONSIVE_RELEASE.md](RESPONSIVE_RELEASE.md). This audit records the earlier code/media release; its historical recording duration and timing refer to that release.

# Public demo readiness report

8 October 2026. Post-event portfolio work; baseline `eabe5e2`. This release preserves the official meeting-to-execution scope. The team missed the event submission deadline; later improvements are not presented as competition work.

## Phase 1 — Comprehensive analysis

Reviewed frontend screens, API/session/permission boundaries, extraction validation, SQLite/PostgreSQL persistence, request quotas, dependency manifests/locks, hosted adapter, Docker packaging and documentation. Prioritized reproducible failures that affect access, saved work, recovery or presentation. This is bounded engineering verification, not a claim that every possible vulnerability has been eliminated.

### Issue ledger

P1 = important correctness/reliability/accessibility defect; P2 = smaller robustness/clarity defect. Detailed reproductions and symbols are in [backend audit](audits/BACKEND.md) and [frontend audit](audits/FRONTEND.md).

| Issue | Severity | Location | Impact before | Result after |
| --- | --- | --- | --- | --- |
| SQLite quota race | P1 | backend/src/services/requestLimits.js | Competing requests could exceed the cap | Atomic conditional UPSERT; losing request gets 429 |
| Unbounded PostgreSQL queries | P1 | backend/src/db/postgres.js; middleware/errorHandler.js | Blocked queries could hold requests indefinitely | Connection 10s, statement 15s, query 20s; safe 503 |
| Failed rollback handling | P1 | backend/src/db/postgres.js | Original failure masked; uncertain connection reused | Preserve original error; discard failed connection |
| Historical transcript hashes | P1 | backend/src/routes/ai.routes.js | Some legacy line endings missed replay | Check canonical LF/CRLF/CR and exact original hashes |
| Calendar year zero | P1 | backend/src/validators/aiOutput.js | JavaScript accepted a PostgreSQL-incompatible date | Reject before saving with 422 |
| NUL text | P1 | backend/src/validators/aiOutput.js | PostgreSQL save failed after apparently valid extraction | Field-specific 422; no partial records |
| Malformed URL | P2 | backend/src/middleware/errorHandler.js | Invalid URL escape caused 500 | Safe 400 BAD_PATH |
| Corrupt password hash | P2 | backend/src/services/passwords.js | Corrupt stored format could crash login | Fail closed; valid login unchanged |
| Expired metadata accumulation | P2 | backend/src/services/postgresSessionStore.js; postgresRequestLimits.js | Expired sessions/quota rows accumulated | Opportunistic cleanup, at most 100 rows/minute/instance; refreshed rows protected |
| AI timeout feedback | P2 | backend/src/services/aiService.js | Timeout looked like generic provider failure | Explicit 504 AI_TIMEOUT; no records saved |
| Stalled sample loading | P1 | app/client/src/App.jsx | Sample fetch could leave paste disabled | 15s abort, readable error and retry |
| Invalid date rendering | P1 | app/client/src/formatDate.js; WorkLists.jsx | Inconsistent data crashed the view | Strict shared date handling; safe fallback; stable calendar day |
| Long names overflow | P1 | app/client/src/styles.css | 375px document widened to 8158px | Shrinkable tracks and wrapping; document stays 375px |
| Clear-filter focus | P1 | app/client/src/WorkLists.jsx | Removed button sent keyboard focus to body | Return focus to the corresponding search input |
| Error associations/loading | P1 | app/client/src/App.jsx | Input errors and pending login lacked associations | Described-by/invalid state, busy form and live progress |
| Hidden creation error after navigation | P1 | app/client/src/App.jsx | User could miss a late failed save | Visible failure and Return to transcript; input preserved |
| Empty directory wording | P2 | app/client/src/WorkLists.jsx | Empty data looked like a search problem | Separate empty and filtered-no-result states |
| Brand accessible name | P2 | app/client/src/App.jsx | Name omitted visible Meeting to Execution text | Accessible name contains the full visible brand |
| Deployment packaging | P1 preventive | Dockerfile; .dockerignore; .vercelignore | Broad copies could include unnecessary local material | Copy runtime sources only; exclude private files and demo media |
| Hosted production mode | P1 preventive | api/index.js | Security behavior depended on external NODE_ENV | Adapter explicitly enables production behavior |
| Missing automated release checks | P2 | .github/workflows/verify.yml | Regressions could reach main without CI | Pinned official actions, tests/build/audits; no CI secrets |
| Stale documentation | P2 | README.md; TESTING.md; deployment guides | Historical counts/setup claims confused first use | Current setup, demo accounts, provenance and limits |

## Phase 2 — Permanent fixes

Repairs change the failing mechanism rather than hiding its symptoms. Focused backend regressions reproduce the original failures. Examples:

```js
// Hosted security must not depend on a dashboard variable.
return createApp({ db, production: true });
```

```js
// Bounded PostgreSQL work; TLS verification remains enabled.
statement_timeout: 15000,
query_timeout: 20000,
connectionTimeoutMillis: 10000
```

Before: separate quota read/check/write. After: one SQLite UPSERT with a conditional update and RETURNING makes consumption atomic. Before: invalid date text reached Intl formatting and threw. After: formatDate.js validates the calendar date before formatting and returns a readable fallback. Before: rollback failure replaced the original error. After: retain that error and release the damaged connection with an error.

### Verification evidence

| Check | Observed result | Scope |
| --- | --- | --- |
| npm run test:all --prefix backend | PASS, 39/39, exit 0 | Actual local HTTP flows with explicitly injected extraction fixtures; stalled local provider fixture |
| npm run build | PASS, exit 0 | Integrated production build, 29 frontend modules |
| npm run test:postgres (backend) | PASS, exit 0 after final maintenance changes | Real Supabase: transactional save/rollback, permissions, concurrency/replay, sessions and atomic quotas; fixture extraction |
| Dependency audits | PASS, zero known findings | Root/backend production dependencies and all frontend dependencies at check time |
| Frontend browser checks | PASS, 18 documented scenarios | Explicitly mocked APIs; keyboard/recovery/stale-response/date/reflow checks |
| Actual recording flow | PASS | Fresh TokenRouter request, HTTP 201, replayed=false, three projects/twelve tasks; expected owners/dates/hours asserted |
| Actual browser role checks | PASS | Isolated database: manager one project; Ali three own tasks; no uncaught JS errors |
| AccessLint | No violations in examined states | Actual login and labeled static workspace preview; not full accessibility conformance |
| Supabase schema review | PASS for examined exposure boundary | Six private tables have RLS; anon/authenticated browser roles lack SELECT |
| Video verification | PASS | Both MP4s fully decode; inspected task/mobile frames; H.264/yuv420p, approximately 85 seconds |
| Docker runtime | NOT RUN | Docker unavailable; source packaging reviewed only |
| Cloud release/CI | See release verification below | Recorded separately after push; not inferred from local build |

## Phase 3 — UI/UX and code improvements

Kept the compact delivery ledger and restrained green/white identity. Improved responsive text wrapping, keyboard focus, persistent labels, loading announcements, correction feedback and recovery across navigation. No new dashboard, decorative effects or unrelated features. Search operates only on already authorized data. Shared date formatting removes duplicated fragile logic; aborting obsolete reads prevents stale results from replacing the active view.

Before/after screenshots are described in the specialist reproductions. The README images show the actual repaired app, not a marketing mockup. Examined widths: 1440, 768 and 375px. Full screen-reader coverage, true 200% browser zoom and comprehensive accessibility certification remain unverified.

## Phase 4 — Demo video and social content

Created actual captioned exports:

- [Landscape MP4, 1920×1080](assets/novaworks-demo.mp4)
- [Vertical MP4, 1080×1920](assets/novaworks-demo-vertical.mp4)
- [Caption track](assets/novaworks-demo.srt)
- [Recording provenance](assets/PROVENANCE.json)
- [Script/storyboard, voiceover and editing guidance](SOCIAL_DEMO.md)
- [LinkedIn, X, Instagram and YouTube drafts](SOCIAL_POSTS.md)

The video records a new real extraction on 8 October using fictional accounts and an isolated local SQLite database. The approximately 11.85-second provider wait is preserved. Additional task/mobile shots use that same saved batch. Captions, framing and opening/closing holds are editorial additions. Exports are silent; the optional voiceover is supplied as text. Public data was not reset for filming. The earlier event recording is preserved separately.

## Phase 5 — Documentation and release

README now leads with the problem, live app, screenshots and video, then explains role credentials, installation, configuration, architecture, tests, hosting and limits. Backend/frontend READMEs and testing guidance match the integrated app. Historical submission material explicitly records the missed deadline. Added a GitHub workflow with least-permission read access and pinned official actions for backend tests, production build and audits.

### Release verification

Code/media release `e0b0c16e7ffe69325d2a99058b2bfb58a9bc2411` pushed to main; local and remote refs matched. GitHub Actions run [37786480078](https://github.com/Aizaz-Noor/Nova-Works/actions/runs/37786480078) completed SUCCESS: backend tests, build and both dependency audits passed.

Vercel production deployment `dpl_GTcQi5kP8hZ6wiinSLaXJvJCioWa` READY on the exact release SHA; public alias verified. `node backend/scripts/verify-deployed.js` exited 0 with PASS for health/login/directory/creation/replay/persistence/role restrictions/direct access/logout, sample counts 3/12 and reusedExisting=true. This cloud check reused saved work; fresh live extraction evidence comes from the separately recorded local flow.

Actual public browser: admin sign-in, no-result filter/clear focus, UrbanCart detail, fresh Ali sign-in, own-task view and logout PASS. At 375px there was no document overflow and no developer assignee filter. Observed shared totals were 11 projects and 11 Ali rows, not the isolated sample counts; no public records were removed for filming. The initial logged-out /auth/me 401 is expected. An ambiguous Clear filters test locator was narrowed to the intended control before rerunning; this was a harness correction, not an app defect.

This evidence-only follow-up changes documentation/caption whitespace and operational state; product source and media remain those verified above.

## Remaining boundaries and owner actions

- Previously exposed private credentials must be rotated privately; rotation is not independently verified. Never paste replacements into chat or Git.
- Shared fictional demo users intentionally allow public exploration. This is not private company authentication. Use fictional meetings.
- Before real private data, replace demo access and introduce a least-privilege runtime database role; the current server uses a privileged connection and server-enforced permissions.
- Concurrent instances can invoke a model twice for one transcript; PostgreSQL still saves one batch and shared quotas bound use. Arbitrary historical mixed-ending hashes cannot all be reconstructed.
- Validation proves structural correctness, not semantic accuracy on every meeting. Provider outages, maximum-length extraction, load behavior and uptime are not guaranteed.
- PostgreSQL cancellation configuration and real normal flows were tested; a live forced server cancellation timing experiment was not run.
- Dependency audits report known advisories at check time, not a universal security guarantee. No unnecessary dependency upgrades were introduced.
- No official submission or social publication was performed. Aizaz reviews the captions/voiceover and publishes the chosen version.
