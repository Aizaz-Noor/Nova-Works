# Pipeline browser acceptance

Verifier: `scripts/verify-pipeline-browser.mjs`. Requires installed Playwright via `PLAYWRIGHT_MODULE`, actual headless Microsoft Edge and `DEMO_URL` (default isolated `http://127.0.0.1:3021`). Run only against a rebuilt isolated test deployment; creates fictional signup/company/business records.

Required flow: signup -> company -> lead with company/email/follow-up -> qualify -> convert customer and deal -> exact potential value USD 1250.50 -> Proposal -> Won -> delivery project. Verify same-company customer/project records through authenticated APIs, duplicate conversion/project replay without duplicate records, refresh persistence, real optimistic conflict recovery, and lead/deal list/detail reflow at 320, 375, 768 and 1366 px without document overflow or uncaught page errors.

Artifacts: `tmp/pipeline-browser/results.json` and per-screen screenshots. Actual result20October2026: PASS exit0 against local3021. All required flow checks passed, including immediate new-project visibility without reload and16list/detail viewport checks. No uncaught page errors or document overflow. Parent visually inspected the320px deal detail. Earlier selector/disclosure verifier failures were corrected before this passing run.
