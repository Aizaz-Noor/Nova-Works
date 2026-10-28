# Entry demo independent verification

23 October 2026. Scope: `ENTRY_DEMO_DELIVERY_PLAN.md`, source checkout `tmp/novaworks-next-notifications`, HEAD `fe9285fd6f5a7089022e66f7549d55111c0cd95d` plus the preserved dirty working tree. Clean runtime checked at `E:/Projects/Hackathon/NovaWorks`. No product files edited by this verifier.

## PASS

- Independently reviewed final entry/auth diff, descriptor socket check, default-off activation, marked SQLite guard, deterministic fictional fixture, disabled-provider launcher and source export. Initial defects in SQLite detection, fixture provenance, provider defaults, origin, error cleanup and awaited seeding were reported and repaired before final runtime checks.
- `node --test backend/test/local-demo.test.js backend/test/company-tasks.test.js backend/test/demo-separation.test.js backend/test/session.test.js backend/test/mfa-http.test.js backend/test/mfa-management-http.test.js backend/test/runtime-startup.test.js`: **12/12**, exit 0. Covers activation/fixed credentials/production/ERP/SQLite restrictions, scoped company/task requests, normal auth/MFA regressions and stored sessions. The full historical backend suite was not repeated.
- Actual isolated HTTP capability requests: normal development and production apps return `localDemo: null`, including a caller-supplied loopback forwarded header. Existing loopback helper tests cover IPv4, IPv6, mapped IPv4 and remote addresses; source uses socket peer rather than forwarded headers.
- `node --test app/client/src/overviewModel.test.js app/client/src/pipelineMoney.test.js`: **8/8**, exit 0. `node scripts/verify-frontend-redesign-static.mjs`: **15 checks**, exit 0.
- Read-only esbuild/static React rendering of Login: six checks cover normal ERP, valid demo, malformed descriptor, legacy entry, capability failure and available signup/recovery. Ordinary ERP hides legacy roles/password text. This executes no effects and supplies no visual or click evidence.
- Actual launcher refusal in isolated copies of the final launcher: production, hosted DB configuration, unmarked data, interrupted initialization and marker/secret without DB all exit 1. Existing fixture bytes retain their pre-check SHA256 values; production/hosted refusal creates no runtime directory.
- Canonical launcher/API check: **16/16**, exit 0. Starts from its own root; descriptor is fictional and billing/recovery/simulated-AI flags are false; unauthenticated tasks and bad password return 401; ordinary `/api/auth/login` issues the session; owner selects its sole company using `/api/v1/organizations/select`; foreign company returns 403 and retains the valid selection; untrusted Origin returns 403; normal task PATCH persists. Customer/project/deal/quote/invoice and sales/delivery/financial report APIs return scoped data. Explicitly disabled AI produces a FAILED job and creates no project. Occupied port refuses visibly. Restart from a different caller cwd preserves the authenticated session, company and task edit; logout revokes access and fresh login retains the saved task.
- Canonical `SOURCE_MANIFEST.json`: **414 source files** independently matched against both source and destination SHA256 at inspection. UTC/HEAD/dirty/exclusion metadata present. No links or junctions found, including installed dependencies. Manifest contains no private environment, runtime DB/log/video/private-key paths; known private-key/token patterns absent. Public `backend/certs/supabase-root.pem` is the intentional certificate exception.
- Independent `npm.cmd ls --depth=0 --prefix E:/Projects/Hackathon/NovaWorks/backend`: exit 0, express 5.2.1, express-session 1.19.0, pdfkit 0.20.2, pg 8.16.3. These are locally reused ordinary dependency files, not a proven fresh backend installation.
- Cleanup through authenticated APIs restored the fictional task to original TODO status, discarded/redacted the verifier's exact failed meeting, and logged out. No direct DB cleanup/reset/deletion. Integrator's final managed launcher remains running on 127.0.0.1:3048.

## FAIL

No reproducible product defect remains in this bounded final HTTP smoke. Two verifier assertions were corrected: port refusal used clearer `Port 3048 is already in use` wording than the initial regex expected; an initial token scanner matched embedded `task-` words and needed a token boundary. These were verification false positives, not product defects.

Clean backend offline dependency installation did **not** succeed: integrator observed `ENOTCACHED` for unicode-trie 2.0.0. The final runtime uses the existing trusted backend dependency cache copied as ordinary files. The verifier independently confirmed dependency listing and runtime behavior; fresh backend lockfile installation remains unproven.

## NOT RUN / BLOCKED

- **BLOCKED:** browser/native rendered entry, keyboard/focus, loading/error click behavior, 320/768/1440px layout, end-to-end UI acceptance and actual video. The existing browser denial expressly prohibited alternate browser/host/port/CDP/proxy workarounds. No browser/capture tool was called. HTTP/static HTML/build success does not satisfy this evidence.
- **NOT RUN:** fresh online backend installation, PostgreSQL/hosted production, real email/payment/provider calls, and a newly recorded complete CRM-to-sales-to-time-to-invoice browser walkthrough. Seeded accepted quote/order, approved time and issued invoice are fictional preconditions created through existing services, not actions performed in a new recording.
- Frontend production build and fresh offline client install passed in integrator evidence (62 modules / 17 packages); the verifier did not repeat the stable build.
- This establishes a bounded local demo/API result. It does not establish full ERP or commercial readiness, complete accessibility or the requested new recording.

## Evidence and next action

Temporary read-only/support checks are retained in the original checkout's ignored `tmp/entry-verifier-static.mjs`, `tmp/entry-verifier-gates.mjs`, `tmp/entry-verifier-http.mjs` and `tmp/entry-verifier-http-results.json`. They contain no session cookie or private key and are excluded from source delivery. Runtime HTTP report records all sixteen successful assertions. Original working files and historical runtime data were preserved.

Integrator has added the README's fictional identities/data/reset/ordinary startup instructions. Include this report as a separately hashed delivery document and preserve the running canonical server. Fresh browser and recording evidence require a legitimately approved capture route; do not substitute old or synthetic video.
