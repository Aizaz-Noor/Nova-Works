# Run the ERP development workspace

This branch implements the first SaaS foundation, not the complete commercial ERP.
The hosted portfolio demo has not been upgraded or deployed by this work.

## Local application

Use Node.js 24. Install locked dependencies, then build the interface:

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix app/client
npm.cmd run build --prefix app/client
Copy-Item backend/.env.example backend/.env
```

Set a private session secret in `backend/.env`, `ERP_ENABLED=1`,
`FRONTEND_ORIGIN=http://127.0.0.1:3001` and leave `DATABASE_URL` empty for SQLite.
Do not put secrets in frontend variables. `npm.cmd start --prefix backend`
applies the additive SQLite platform migrations and serves the application.
Create an ERP account and company using test data. Email verification, recovery,
MFA and commercial operations are not complete; this is not a private production launch.

Optional public fixture accounts require the existing seed command. Importing legacy
demo records into the identified Demo Organization is an explicit migration action:

```powershell
npm.cmd run seed --prefix backend
npm.cmd run db:migrate:erp --prefix backend -- --backfill-demo
```

This snapshots fixture records without deleting the original demo. New demo records
are not continuously synchronized; the public legacy workflow and commercial tables
are separate. Do not add commercial identities to the public fixture directory.

## Reviewed AI

The demo administrator's interface extracts a persisted draft, allows corrections,
then approves an atomic save. The original auto-save endpoint remains available only
as a legacy demo compatibility API. Private commercial AI jobs are a later roadmap
item; the new company workspace does not claim to run them yet.

Fresh extraction requires an authorized server-only provider key. Acceptance tests
use explicitly labeled fixtures and make no paid requests.

## PostgreSQL

Apply migrations using a separate schema-owner connection, then provision a restricted
runtime identity using [POSTGRES.md](POSTGRES.md). Runtime startup refuses privileged
roles and missing forced RLS. Hosted migration is explicit; the API never performs
schema-owner migrations in ERP mode. Set `DATABASE_MIGRATION_URL` only in the operator
migration environment, never the API deployment.

The local disposable verifier `scripts/verify-local-postgres.mjs` uses a loopback
PostgreSQL instance on port 55439 and temporary databases. It reads only the local
test password file; it never reads hosted `DATABASE_URL`. Portable binaries and all
generated databases live under ignored `tmp/pg-portable`, outside product dependencies.
Package provenance: `@embedded-postgres/windows-x64@18.4.0-beta.17`, binary PostgreSQL18.4,
registry integrity verified by npm. This is a disposable test runtime, not deployment packaging.

## Checks

```powershell
npm.cmd run test:all --prefix backend
npm.cmd run build --prefix app/client
node scripts/verify-local-postgres.mjs
```

Browser checks need an installed Playwright module and Edge. Set `PLAYWRIGHT_MODULE`
to its `index.mjs`. Run the ERP app on3019 with matching frontend origin, then
`node scripts/verify-erp-browser.mjs`. For AI fixture UI acceptance, run
`node scripts/start-review-verification.mjs`, then `node scripts/verify-review-browser.mjs`.
These scripts create fictional local test accounts and data. Their results and screenshots
are saved under ignored `tmp/erp-browser`, `tmp/review-browser` and `tmp/postgres-checks`.

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the complete roadmap and open launch gates.

## Connected customer workspace

After selecting a company,owners/admins/managers can open **Customers** to manage relationships,contacts,activities and existing-project links. Concurrent edits require reloading the latest version; unsaved text is preserved. Members cannot accessCRM. SQLite applies migration004 on localERPstartup; PostgreSQL operators must run explicit migrations and refresh restricted grants before starting the updated API.

CRM browser acceptance: `node scripts/verify-crm-browser.mjs` against the local3019 app. CRM backup drill: `node scripts/verify-crm-restore.mjs backend/data/erp-development.sqlite` creates a new backup and restored file under ignoredtmp and compares exact business rows without changing the source. Use a fictional test workspace with actual customer,contact,activity and linked-project records.


## Sales pipeline

Open **Pipeline** as a company owner/admin/manager. Create a lead, qualify it and convert it to a customer/contact and deal. Set potential value and stage; Won deals can create a delivery project. Closed deals are read only; potential value does not record revenue. Follow-up dates are manual reminders only.

Migration005 adds pipeline tables and default stages for existing and new companies. PostgreSQL operators must run versioned migrations as the migration owner and refresh provision-runtime.sql grants; runtime must remain a separate non-owner role. Do not apply the review SQL directly. Existing005 seed runs inside the migration transaction and restores FORCE RLS before commit.

Local acceptance uses a fresh fictional database on3021 with matching FRONTEND_ORIGIN. Run node scripts/verify-pipeline-browser.mjs with PLAYWRIGHT_MODULE configured, node scripts/verify-local-postgres.mjs against the separate loopbackPostgreSQL server, node scripts/verify-pipeline-upgrade-postgres.mjs for existing-company migration proof, and node scripts/verify-pipeline-restore.mjs backend/data/pipeline-development.sqlite for freshSQLite restore. PostgreSQL backup restoration and hostedstaging remain unverified.


## Quotes and sales orders

Use Prepare quote on a deal, or Quotes -> New quote -> choose a customer. Save item prices/whole quantities/explicit tax percentages, review server totals and issue the saved quote. Save unsaved edits before issuing. Issued terms are locked; Create quote revision supersedes them with a new draft. Owners/admins record customer acceptance with an external-evidence reference; no customer email is sent. Create sales order preserves that accepted version and opens the same order on retries. Managers edit their own records/customer/deal only; members have no sales access. Sales orders are not invoices.

Migration006 and refreshed runtime grants are required on PostgreSQL. Trigger functions are invoker functions; quote terms/items and sales orders have database immutability guards in addition to API checks. The reviewedSQL file is a reference; apply through db:migrate:erp. SQLite migrates automatically with ERP_ENABLED=1. Local quote verification uses PORT3022,DATABASE_PATH=data/quotes-development.sqlite,FRONTEND_ORIGIN=http://127.0.0.1:3022 and the existing local sessionsecret configuration. [Quote acceptance](QUOTES_ACCEPTANCE.md) records commands/artifacts and limitations.


## Timesheets

All company members have a Timesheets tab. My time -> Log time lists real permitted projects/tasks; members must choose an assigned task. Enter whole minutes and an actual UTC workdate, save, review the saved version and submit. A different projectmanager orcompanyadmin reviews it under Team review. Rejection needs a note; worker corrections/resubmission keep the history. Approvedtime is read only; discard is available for your draft/rejected mistakes and keeps a historical VOIDrecord. Approval does not create an invoice.

Migration007 must run under credentials that own platform_tasks (new composite-reference index), then refresh the separate restricted runtime grants. Never modify applied002-006 SQL. CurrentSQLite localverification uses PORT3023,DATABASE_PATH=data/timesheets-development.sqlite and FRONTEND_ORIGIN=http://127.0.0.1:3023. All sample users/data are fictional. [Timesheet acceptance](TIMESHEETS_ACCEPTANCE.md) lists testcommands,evidence andopenlimits.


## Client invoices

Owners/admins open Invoices or Prepare invoice on an accepted salesorder. Save billingdetails,review copied line amounts,andissue the saved invoice. Numbers are assigned only onissue; eachcompany has its own INV/CNsequence. Payment evidence records external receipts without movingmoney. A reversal preserves the original record. Fullcredit is available only with zeroactivepayments andcanproduce a replacement draft/newnumber; partialcredits andrefunds are notimplemented. Approvedtime remains separate frompricedinvoices.

Migration008 plus refreshed runtime grants are required forPostgreSQL. Do notgrantUPDATE toimmutable salesorders toenable invoice creation: the service uses a scoped source advisorylock. Financial detail reads take a sharedinvoice lock; writers take anexclusive lock. New dependency PDFKit0.20.2 is pinned; use lockfile installation. PDF export currently rejects unsupported non-basic-Latintext with422 instead of changing saveddata. Export is issued-snapshot only andrequires the same owner/admin permission as invoice views.

Local verification uses PORT3024,DATABASE_PATH=data/invoicing-development.sqlite,FRONTEND_ORIGIN=http://127.0.0.1:3024. Scripts andevidence are in [invoicing acceptance](INVOICING_ACCEPTANCE.md). ThePDFverification Python script needs the bundledpypdf,pdfplumber,pypdfium2/Pillow runtime; these are verificationtools,not productionserver dependencies.
