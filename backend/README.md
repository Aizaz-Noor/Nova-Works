# NovaWorks backend

Express 5, cookie sessions, validated meeting extraction and persistent role-scoped work. See the [root README](../README.md) for setup and demo accounts and [BACKEND_API.md](BACKEND_API.md) for request/response contracts.

From the root, install with `npm.cmd ci --prefix backend`, configure private `backend/.env`, build the frontend, then run `npm.cmd run db:init --prefix backend`, `npm.cmd run seed --prefix backend` and `npm.cmd start --prefix backend`. Node.js 24 is required. The server serves frontend and API together at http://127.0.0.1:3001 by default.

SQLite is the local default. With a private DATABASE_URL, Supabase PostgreSQL stores projects, tasks, submission markers, sessions and quotas. Express determines identity from sessions and enforces access on every query. Browser roles have no grants on the private novaworks schema. Keep TLS verification enabled. Hosted setup: [Vercel](../VERCEL_DEPLOYMENT.md), [Supabase](../SUPABASE.md).

TokenRouter receives the transcript and an allowlisted directory, never password/session fields. The server validates employee references, roles, real dates, descriptions and positive estimates before a single transaction saves the batch. Provider or validation failures save nothing. A saved identical transcript is replayed rather than regenerated. Semantic correctness still requires inspection.

Run `npm.cmd run test:all --prefix backend`. PostgreSQL acceptance and genuine model tests are optional private-environment commands described in [TESTING.md](../TESTING.md); they are not required to browse the demo. Audit fixes and limitations are in [the public-demo report](../docs/PUBLIC_DEMO_REPORT.md).

The reset command intentionally deletes generated local work and submission markers; never use it on shared/public data. For filming, prefer the separate recording server described in TESTING.md. Fictional public demo credentials are not suitable for private company data.