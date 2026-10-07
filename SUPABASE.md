# Supabase database mode

SQLite remains the default when DATABASE_URL is empty. The frontend and Express authentication routes are unchanged. Supabase is used as PostgreSQL storage, not Supabase Auth or a browser Data API.

Set DATABASE_URL only in the private backend environment/deployment secret manager. Copy the exact session-pooler string from the Supabase dashboard for an IPv4 persistent backend; encode reserved characters in the password. TLS certificate verification remains enabled. Never commit a URL or put it in a VITE variable.

Run from backend: `npm ci`, `npm run db:init`, `npm run seed`, `npm run test:postgres`, then `npm start`. Startup checks database connectivity and applies the idempotent SQL file before listening. Schema migrations require a schema-owner connection; runtime presently uses that configured connection. A separate restricted runtime role is recommended before production; do not grant browser roles access.

The migration creates private novaworks tables, revokes anon/authenticated access and enables RLS with no browser policies. Server queries are explicitly qualified. Existing Express session/RBAC checks control each request. Seed uses supplied fictional demo accounts; no existing local SQLite records are copied automatically.

`npm run test:all` checks unchanged SQLite behavior. `npm run test:postgres` refuses to run without DATABASE_URL and checks a real database using clearly labeled fixture-provider records, concurrent deduplication, rollback, role access, sessions surviving connection restart and atomic quotas. It removes its own generated records; supplied users remain. A passed fixture test does not verify live AI or deployed HTTPS behavior.

Public deployment also requires SESSION_SECRET, exact HTTPS FRONTEND_ORIGIN, NODE_ENV=production and the hosting-specific trusted proxy setting. Keep TokenRouter secrets server-side. Use same-origin frontend/API hosting to preserve cookies. Supabase does not host this Express container: an application host is still required. DB creation alone is not deployment.

Set REQUIRE_POSTGRES=1 on ephemeral hosting to fail startup if DATABASE_URL is missing, rather than silently use SQLite. /api/health queries the active database and returns generic 503 during database outage.

If connection fails with SELF_SIGNED_CERT_IN_CHAIN, download the database CA certificate from the actual Supabase project settings and set DATABASE_CA_FILE to that PEM path (or install the verified CA through NODE_EXTRA_CA_CERTS). Do not disable certificate verification. URL SSL query options are removed so verified TLS settings and the explicit CA remain authoritative.

For hosted secret managers, DATABASE_CA_CERT may contain the complete PEM certificate text as actual multiline content instead of a file; DATABASE_CA_FILE overrides it when configured. Certificates are public trust material; only use the certificate downloaded from the official project.
