# Backend API — NovaWorks

Integrated Express/SQLite backend for the Code Nomads Infinity Hack MVP. Frontend and backend run together; see ../README.md and ../TESTING.md for complete setup and accounts. Provider: TokenRouter, deepseek/deepseek-v4-flash-0731. Actual original and modified transcript acceptance tests passed. POST/admin extraction validates the full draft before saving in a transaction; errors save nothing. Passwords never reach the model.

Use Node24+. From repository root: npm.cmd ci --prefix backend; npm.cmd run db:init --prefix backend; npm.cmd run seed --prefix backend; npm.cmd start --prefix backend. Build frontend first using npm.cmd run build --prefix app/client. Combined URL127.0.0.1:3001. Exact configuration names/placeholders in .env.example. TOKENROUTER_API_KEY is private/server-only. TOKENROUTER_MODEL defaults to deepseek/deepseek-v4-flash-0731; TOKENROUTER_BASE_URL defaults to https://api.tokenrouter.com/v1. JSON output plus application validation is used; native provider JSON-schema enforcement is not assumed.

SQLite persists users, projects, tasks, duplicate-submission markers and sessions. Keep the database and SESSION_SECRET stable across restart. Demo users are fictional; all supplied passwordsDemo123!. Only admin can create. Managers access assigned projects/tasks; agents access own tasks and related projectmetadata. All direct requests use session identity.

Tests: npm.cmd run test:all --prefix backend (13passed); npm.cmd run test:live --prefix backend (two authorized real model requests, bothpassed). Reset: npm.cmd run reset:projects --prefix backend intentionally deletes generated work/submission markers, preserving users and sessions. See BACKEND_API.md for routes/shapes.

Docker-only deployment preparation is in ../Dockerfile and ../DEPLOYMENT.md. One instance, persistentvolume and HTTPS with securecookies; TRUST_PROXY=1 only behind one trustedingress. Docker execution not available here; no hosteddeploy/submission claimed. Model output may be semantically wrong despite structural validation; uncertainty requires correction. No signup/user management/progress/costs/editing.
