# CRM browser acceptance

Verifier: `scripts/verify-crm-browser.mjs`. Uses installed Playwright through `PLAYWRIGHT_MODULE`, actual headless Microsoft Edge and `DEMO_URL` (default `http://127.0.0.1:3019`). Run against a rebuilt local isolated test deployment, never a customer database: it creates a fresh test account, company and customer records.

Expected flow: register -> create/select company -> create delivery project -> Customers -> create Acme Studio -> edit with optimistic version -> add contact -> add NOTE activity -> link existing company delivery project -> refresh and verify persistence -> server search. Inspect customer detail and list at 1366, 768, 375 and 320 pixels, asserting no horizontal document overflow and no uncaught page errors.

Evidence writes `tmp/crm-browser/results.json` and screenshots per viewport. PASS requires an actual browser execution against the rebuilt server; script existence, source inspection and a build do not prove this flow.

Current status: actual local Edge acceptance PASS; see observed evidence below.


## Observed local acceptance

2026-10-20 Asia/Karachi: actual headless Microsoft Edge run against rebuilt `http://127.0.0.1:3019` exited 0, result PASS. Evidence: `tmp/crm-browser/results.json`, started `2026-10-19T19:23:49.443Z` (2026-10-20 00:23:49 PKT).

Verified registration/company/project/customer creation; customer update with optimistic version; another editor's actual PATCH makes the stale UI save return HTTP 409; entered text survives the conflict and reload; reopening Edit customer and saving with refreshed version succeeds. Verified contact, NOTE activity and existing-project link, all preserved after page refresh, plus server-side customer search (`q` request observed).

Customer detail and list each showed no document overflow at 1366, 768, 375 and 320 px. No uncaught page errors. The first conflict verifier run needed a locator correction because reloading saved information closes the Edit customer disclosure; the corrected verifier explicitly reopens it and passed. Screenshots are saved for each inspected viewport. These are local browser results; no paid service or public deployment acceptance is implied.


Final parent integration: build exit 0, backend 68/68 pass, real PostgreSQL CRM and
runtime history-denial checks pass. The final Edge run includes heading/search focus
recovery and started at 2026-10-19T19:30:04.799Z (20 October, 00:30:04 PKT).
A preceding concurrent browser/backend run timed out on a contact click; its original
result is retained as `tmp/crm-browser/results-failed-concurrent.json`. The sequential
rerun passed. Screenshot failure handling preserves the original error. No load-test
guarantee is inferred.
