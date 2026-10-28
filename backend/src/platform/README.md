# Multi-tenant foundation integration

Run `node src/platform/migrate.js` with migration credentials. Optional
`--backfill-demo` copies legacy fixture projects/tasks to `novaworks-legacy-demo`
without modifying legacy data. It is an explicit snapshot, not bidirectional sync.
Version and SHA-256 checksums live in `platform_migrations`; modified applied
migrations fail startup. PostgreSQL migration transactions use an advisory lock.

Application integration: migrate before mounting, then mount `platformRoutes(db)`
at `/api/v1` behind existing session, origin/CSRF and `requireAuth(db)`. Registration
uses `createPlatformService(db).register`, protected by a rate limiter. Regenerate
the session before assigning its returned user ID. Every selected organization is
verified again on each service transaction. Never accept a role or user ID from
request input. Protect all legacy data and AI routes with `requireLegacyDemo(db)`.
New registered accounts use legacy AGENT only for schema compatibility; that role
must never grant access to the global legacy demo.

`POST /organizations/select` persists `{organizationId}` in the trusted session.
The `/organizations`, `/members`, `/projects`, `/projects/export`, `/drafts/:id`
and `/files/:id` routes require session identity. Invitations require OWNER/ADMIN,
are hashed in storage, expire in 48 hours, are single use and match the signed-in
account email. Only OWNER can invite ADMIN. The token is returned once for manual
delivery; no email service is configured or implied. Accounts must possess the
invitation token; a public registration using an existing email never links an
account. Production still needs verified-email recovery and ownership procedures.

## PostgreSQL deployment gate

Use different migration and runtime credentials. Runtime needs schema USAGE,
CRUD on the eight `platform_*` tables, SELECT/INSERT on users for auth/onboarding,
and permissions required by the existing session store. It must not have CREATE,
TRUNCATE, superuser, BYPASSRLS, membership in the migration role, or access to other
tenant tables through SECURITY DEFINER functions. Existing legacy users/session
tables have their own RLS configuration; an administrator must deliberately grant
appropriate policies for the runtime auth role without exposing them to anon or
authenticated database roles. Do not blindly grant ALL on the schema.

After migrations, call `assertPlatformRuntimeRole(db)` on the runtime connection;
it refuses superuser/BYPASSRLS and missing forced policies. Set
`DATABASE_AUTO_MIGRATE=0` for the runtime to avoid the existing legacy auto-migrator.
Transactions set `app.user_id` and `app.organization_id` with transaction-local
`set_config(...,true)` on the pinned connection. Tenant data defaults to no rows
without context; composite tenant foreign keys independently reject cross-company
references. Database credentials are trusted server capabilities and must never be
given to end users, who could otherwise forge custom PostgreSQL settings.

SQLite enforces composite foreign keys and service-level tenant scopes. SQLite
does not implement RLS and is for local development only; no test against SQLite
proves PostgreSQL isolation. Run real PostgreSQL tests as a non-bypass runtime role
before accepting a commercial deployment. Also validate restore and upgrade paths.

Commands tested: `node --test test/tenant-foundation.test.js` exercises onboarding,
two companies (2 users/3 projects; 3 users/2 projects), invitation expiry/replay and
email mismatch, cross-company mutation and reference/export denial, membership
revocation, composite FK rejection, migration checksums and reopened persistence.
Generated-policy assertions are explicitly not a live PostgreSQL test.

The service is an additive foundation. It does not yet supply file storage,
background AI jobs, CRM, invoicing, subscription billing, accounting or an ERP
release. Draft and file reference tables prevent foundation references from
becoming an unscoped path when their real modules are implemented.
