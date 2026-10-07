# Vercel deployment

Live portfolio: https://nova-works-zeta.vercel.app

Repository root (blank Root Directory), Framework Other, Node24.x. vercel.json installs npm ci, builds npm run build, serves app/client/dist, and routes /api/* to Express. Keep dashboard overrides consistent with these values.

Server-only variables: DATABASE_URL (Supabase Session Pooler), SESSION_SECRET (random32+characters), TOKENROUTER_API_KEY, TOKENROUTER_MODEL, FRONTEND_ORIGIN=https://nova-works-zeta.vercel.app, NODE_ENV=production. The adapter handles trusted HTTPS ingress itself. Vercel's exact production, deployment and branch domains are allowed; unrelated origins remain forbidden.

The verified public Supabase root certificate is bundled. DATABASE_CA_CERT is optional for a custom trust chain. Do not set DATABASE_CA_FILE on Vercel. TLS certificate and hostname verification stay enabled. No passwords, keys, local databases or private environment files are deployed. The Supabase schema and demo users are already initialized; functions do not run migrations at cold start.

Verification8October2026: clean build PASS;25backendtests PASS; realPG transactional/RBAC/session/quota acceptance PASS; public HTTPS health/login/cookie/session/directory/liveAI exact3projects12tasks/replay/persistence/forbidden-access/logout PASS. Browser login/projectdetail/refresh/sample replay PASS. Mobile375px no observed horizontal overflow. These are functional portfolio checks, not a guarantee against every possible bug or a full accessibility audit.

Repeat deployed acceptance: node backend/scripts/verify-deployed.js
This performs live AI only when its official meeting has not already been saved. With the current saved sample it reuses results. Use fictional data only.
