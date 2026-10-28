# Restricted PostgreSQL runtime

Use two credentials: a database owner/migration connection available only to an operator or release job, and a dedicated restricted API login. Never expose either to frontend code. Keep passwords in the deployment secret manager; this repository contains no credential provisioning password.

## Provisioning order

1. Back up the database and verify a separate staging restore. Apply `001_postgres.sql`, then versioned platform migrations including AI review, using migration credentials. Existing `platform_*` tables must have enabled and forced tenant RLS.
2. Run this template through `psql` as a database administrator that can create a role and grant rights on these objects. Supply the role as a quoted psql variable; do not concatenate it into SQL.

```powershell
psql --dbname=$env:DATABASE_MIGRATION_URL -v runtime_role=novaworks_runtime -f backend/scripts/provision-runtime.sql
```

3. The script creates a passwordless LOGIN role if absent and rejects elevated attributes, inherited memberships and owned objects. Provision its password through the provider/secret manager, then set `DATABASE_URL` to that restricted connection and `DATABASE_AUTO_MIGRATE=0` for the API. Keep `DATABASE_MIGRATION_URL` out of the API deployment; use it only in the separate migration job. Never execute schema initialization or demo seed jobs with the runtime role.
4. If the script rejects inherited `CREATE` or `TRUNCATE`, inspect existing database/schema PUBLIC grants with an operator. The script deliberately stops instead of modifying unrelated users' permissions. Make a scoped database hardening decision, then rerun. Review existing schema policies before sharing this role with other services.

The transaction clears this role's existing `novaworks` table/function/schema grants and assigns only API operations: global users SELECT/INSERT; demo projects/tasks/submissions SELECT/INSERT; sessions and quotas SELECT/INSERT/UPDATE/DELETE; AI drafts SELECT/INSERT/UPDATE; platform company tables CRUD under their existing tenant policies. Only the two invoker validation-trigger functions receive EXECUTE. No ownership, permanent DDL, TRUNCATE, migration-history writes, grant options or bypass privileges are granted. Future migrations require an explicit grant review; there are no broad default grants.

## Authorization boundaries

The global identity table serves authentication and commercial registration. Legacy demo records and server session/quota state have explicit policies scoped to the dedicated runtime role because the original tables enabled RLS with no policies. Their business roles are enforced by authenticated API checks and scoped queries. Database grants alone do not distinguish an administrator, manager and developer sharing one API credential.

Company `platform_*` tables retain forced RLS. The server sets `app.user_id` and `app.organization_id` inside each transaction; absent context fails closed. Those settings are trusted server inputs: possession of the raw runtime database credential permits choosing settings, so keep credentials private and preserve API membership checks. Do not add permissive always-true policies to company tables.

## Required staging acceptance

Connect as the actual runtime login and verify catalog attributes and ownership; login/session set/touch/logout; invalid-login counters; reviewed extraction approval/replay; company onboarding/invitation acceptance; two-company project/task isolation; empty or rejected access without tenant context. Verify attempts to CREATE/ALTER/DROP/TRUNCATE or write migration history fail. Run a real PostgreSQL backup restore drill separately.

`node --test backend/test/runtime-role.test.js` checks the provisioning contract and operation matrix in the SQL source. It does **not** execute PostgreSQL, demonstrate live privilege effectiveness, or establish production readiness. Use the staging acceptance above before changing production credentials.

References: [PostgreSQL policies](https://www.postgresql.org/docs/current/sql-createpolicy.html), [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [safe psql interpolation](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-INTERPOLATION).

CRM migration004 adds customers,contacts,activities and customer-project links under forcedtenantRLS. Re-run the reviewed provisioning script after migration using operator credentials. For the application role,activity and audit tables are SELECT/INSERT only; UPDATE/DELETE attempts are denied. Other company tables retain scoped CRUD. This narrows the earlier blanket company-table grant described above. Local PostgreSQL acceptance now executes these grants and verifies denials; hosted staging/production recovery remain separate gates.


Sales migration006 adds forcedRLS for quotes,quote_items,sales_orders,sales_order_items. Apply versioned migrations first, then refresh the separate restricted runtime grants. Orders/items permit only SELECT/INSERT. Draft quote/item writes are scoped; database triggers protect issued terms/items and terminal transitions. Invoker triggerfunctions use fixedsearch_path and explicit runtimeEXECUTE grants, with PUBLICEXECUTE revoked. Actual localPostgreSQL quote flow/concurrency/mutationdenials/upgrade have evidence; hostedstaging and PostgreSQL disasterrecovery remain separate open gates.


Timesheet migration007 adds forcedRLS to time_entries/time_approvals and an index on existingplatform_tasks for its compositeprojectreference. Migrationowner must own thattable; operators run versionedmigrations before refreshing runtime grants. Entries receive SELECT/INSERT/UPDATE; approvals SELECT/INSERTonly. Submitted/approvedcontent is protected by invoker triggers; private-runtime APIchecks enforce worker/project/independentreview rules. Per-worker membership rowlocks serialize dailycap checks. LocalPostgreSQL acceptance exercises concurrentcreation/cap/review andimmutability/tenantdenials; hostedstaging andPostgreSQLrestore are still unverified.


Invoicing008 adds forcedRLS for client_invoices,invoice_items,payment_records,credit_notes,invoice_counters. Refresh runtime provisioning after versionedmigration. Invoice/counter rows SELECT/INSERT/UPDATE; documentitems/payment/credit history SELECT/INSERTonly. Invoker triggers freeze snapshots/issuedheaders/history andhave explicit runtimeEXECUTE grants withPUBLIC revoked. Originalsource creation uses a scoped advisorytransactionlock because FORUPDATE on anappend-only order wouldrequire UPDATEprivilege. Financialdetail reads use FORSHARE oninvoice; ledgerwriters useFORUPDATE. LocalPG acceptance exercises concurrentnumbering,replays,overpayment/credit boundaries,PDFauthorization,no-contextRLS andhistorydenials; productioncredentialrotation,staging andPostgreSQLrestore remain open.
