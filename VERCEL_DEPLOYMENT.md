# Vercel deployment

Use repository root (blank Root Directory), Framework Other, Node24.x. vercel.json supplies install npm ci, build npm run build, output app/client/dist, and routes /api/* to the Express function. Remove old dashboard build/install overrides or set them to these exact values.

Set Production environment variables privately: DATABASE_URL (rotated Session Pooler URL), DATABASE_CA_CERT (full PEM certificate text), SESSION_SECRET (random32+characters), TOKENROUTER_API_KEY (rotated), TOKENROUTER_MODEL, FRONTEND_ORIGIN=https://nova-works-zeta.vercel.app, NODE_ENV=production, TRUST_PROXY=1. Do not set DATABASE_CA_FILE on Vercel; it is a local file path. Hosted handler requires PostgreSQL and skips schema changes on cold starts. Demo accounts already seeded in Supabase.

After deploy: /api/health must return JSON success true. Test sign-in, directory, transcript conversion, refreshed saved projects, logout, manager and agent restrictions. A successful static build alone does not prove the API works. Preview login requires FRONTEND_ORIGIN matching the exact preview URL.

Local evidence8October2026: root npm run build PASS exit0; backend test:all PASS19/19; actual api/index.js handler onHTTP realSupabase health/login/team/logout PASS exit0. Vercel cloud bundling/runtime verification pending.
