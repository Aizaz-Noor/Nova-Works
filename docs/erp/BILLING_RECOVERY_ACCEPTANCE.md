# Billing recovery local acceptance

Implemented owner-only provider-verified subscription linking, reconciliation and replacement after independently checking that the old provider subscription is canceled. Provider GET runs outside SQL transactions; durable leases and subscription versions fence stale results. The browser cannot supply plan or subscription status. Failed requests retain a bounded retry identity; completed replay returns current access state. A scoped periodic runner checks companies owned by its explicit identity.

## Observed results

- `cd backend; npm.cmd run test:all`: exit 0, 103 tests passed, zero failed.
- `cd app/client; npm.cmd run build`: exit 0, 43 modules. Compilation is not browser evidence.
- `node scripts/verify-billing-recovery-postgres.mjs`: exit 0, restricted PostgreSQL HTTP linking, role/company denial, replay, webhook during GET, conflict/retry, canceled-old replacement, business preservation, no-context RLS, denied DELETE and restart passed.
- `node scripts/verify-billing-recovery-upgrade-postgres.mjs`: exit 0, 19 populated prior tables and 002-011 checksums preserved; NOSUPERUSER NOBYPASSRLS migration role, forced tenant RLS and repeat migration passed.

These checks use local disposable databases and an injected fictional provider reader. Transport unit tests use fake fetch. No merchant account, actual Paddle response, checkout, charge or hosted scheduler has been verified. The periodic runner is owner-scoped, not an all-company control plane.

## Additional observed results

- `node scripts/verify-billing-recovery-browser.mjs` with the bundled Playwright module: exit0. Edge performed owner linking, failed provider lookup and same-request retry, canceled read-only recovery, independently verified replacement, business-record preservation and reload. Sixteen viewport checks at1366/768/375/320 found no horizontal overflow; zero uncaught page errors.375px initial/replaced forms visually inspected. This verifier starts and closes its own3028 fixture server; no persistent preview is claimed.
- `node scripts/verify-billing-recovery-restore.mjs data/billing-recovery-development.sqlite`: exit0. Fresh restore matches31 tracked table digests; integrity and foreign keys OK. One subscription, three operation records and delivery/audit rows populated; finance, AI and webhook receipts empty in this fixture. Prior receipt compatibility is covered separately by unit/upgrade checks.
- Child-process smoke with `ERP_ENABLED=0`, `BILLING_RECONCILER_ENABLED=0`, empty `SUBSCRIPTION_COMMAND`: both daemon and operator CLI refuse startup with expected exit1 before database opening/provider calls.
- `git diff --check`: exit0.

## Operation

Configure the reviewed billing policy and restricted runtime database before enabling the provider. `PADDLE_API_KEY` stays server-side; `PADDLE_ENVIRONMENT` selects sandbox or production fixed hosts. The key requires subscription read permission. No mutation API exists in this slice.

`npm run billing:operate` requires SUBSCRIPTION_COMMAND (PROVISION, RECONCILE or REPLACE), SUBSCRIPTION_OWNER_USER_ID, SUBSCRIPTION_ORGANIZATION_ID and preferably a retained SUBSCRIPTION_REQUEST_ID. Provision/replacement require PADDLE_SUBSCRIPTION_ID; replacement also requires PADDLE_PREVIOUS_SUBSCRIPTION_ID. Retries reuse the same request ID; bounded failed attempts require operator review.

`npm run worker:billing` requires ERP_ENABLED=1, BILLING_RECONCILER_ENABLED=1 and BILLING_RECONCILER_USER_ID identifying an owner. It checks only that identity's owned companies, with hourly durable replay keys. Poll interval defaults60seconds; accepted range60seconds to1hour. Hosted process supervision and all-company scheduling remain unverified.

Company settings and remaining commercial/full ERP gates stay open.
