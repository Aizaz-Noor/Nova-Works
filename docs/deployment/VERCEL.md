# Vercel deployment

NovaWorks uses `vercel.json` for its Vercel build and API route configuration. Set the project root to the repository root and use Node.js 24. Keep dashboard overrides aligned with `vercel.json`.

The hosted application requires server-only configuration, including a PostgreSQL `DATABASE_URL`, a private `SESSION_SECRET`, and the exact public `FRONTEND_ORIGIN`. Configure these values in Vercel's environment settings; never put them in source files or frontend variables. Configure the database TLS trust settings only from the certificate supplied by the database provider. Keep certificate and hostname verification enabled.

Before deploying a schema change, take a protected database backup and rehearse restoring it to a separate database. Apply the reviewed migrations using a schema-owner connection before deploying the application version that depends on them. Do not run schema migrations on function cold starts.

After deployment, verify health, sign-in, role-based access, the primary customer-to-invoice workflow, refresh persistence and database isolation against the deployed service. A successful build does not establish that the live workflow or database is correct. Use fictional sample data only.
