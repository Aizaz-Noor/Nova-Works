# NovaWorks — Meeting to Execution

Code Nomads | Infinity Hack '26 | AI Project Manager challenge

## What works

React frontend and Abdullah's Express/SQLite backend are integrated. Login/logout, ten-person directory, session-enforced project/task access, validation, duplicate prevention and atomic persistent saves are implemented. All 10 backend tests pass. Browser checks passed for real login/directory/logout and provider-not-configured recovery. A visibly labeled, isolated test fixture verified successful saving, project detail and developer filtering; it is not live AI evidence.

**Live AI remains unverified.** The current backend uses OpenRouter. Requested TokenRouter integration and original/modified transcript acceptance remain next. Without credentials/model, conversion returns an error and saves nothing. This is not yet a complete challenge submission.

## Team

- Aizaz: product, UI/UX, React frontend, integration and main pushes.
- Abdullah: delivered backend branch Abdul-8869-backend (42da5e1), authentication, SQLite, extraction adapter, validation and tests.
- Abdul Basit: assigned backend/AI support; further delivered contributions not verified here.

Repository: https://github.com/Aizaz-Noor/Nova-Works
Live app: Not deployed. Demo recording: Pending. Submission: Not submitted.

## Stack and requirements

Node.js 24+ (tested24.12.0), npm, React19.2.8, Vite6.4.3, JavaScript/plainCSS, Express5, express-session, built-in SQLite. Actual AI requires authorized provider credentials and a tested model. Sessions use HttpOnly cookies and an in-memory server store; sign in again after server restart. Projects/tasks persist in SQLite.

## Run locally

```powershell
git clone https://github.com/Aizaz-Noor/Nova-Works.git
cd Nova-Works
npm.cmd ci --prefix app/client
npm.cmd ci --prefix backend
npm.cmd run build --prefix app/client
Copy-Item backend/.env.example backend/.env
```

Edit backend/.env: set a private SESSION_SECRET of at least32characters. Keep FRONTEND_ORIGIN=http://127.0.0.1:3001. Configure only authorized AI credentials/model. Never commit .env or place keys in browser variables.

```powershell
npm.cmd run db:init --prefix backend
npm.cmd run seed --prefix backend
npm.cmd start --prefix backend
```

Keep that terminal open. Visit **http://127.0.0.1:3001/**. Backend serves the built frontend and API on one origin. Default database: backend/data/novaworks.sqlite. Seed reruns preserve ten unique accounts. For Vite development run npm.cmd run dev --prefix app/client, change FRONTEND_ORIGIN to http://127.0.0.1:5173 and restart backend. Vite proxies /api to3001. Use exactly the configured browser origin.

## Environment variables

| Variable | Purpose | Location |
| --- | --- | --- |
| PORT | Backend port, default3001 | backend/.env |
| DATABASE_PATH | SQLite file, relative to backend | backend/.env |
| SESSION_SECRET | Private session signing secret, minimum32characters | backend/.env |
| FRONTEND_ORIGIN | Exact allowed browser origin | backend/.env |
| OPENROUTER_API_KEY | Current server-only provider credential | backend/.env |
| OPENROUTER_MODEL | Current tested provider model ID | backend/.env |

TokenRouter configuration is pending. Frontend needs no private environment variables.

## Demo accounts

All passwords are **Demo123!**. Emails are fictional login identifiers, not inboxes.

| Role | Name | Email |
| --- | --- | --- |
| Admin | Admin | admin@novaworks.example |
| Manager | Ayesha Khan | ayesha@novaworks.example |
| Manager | Bilal Ahmed | bilal@novaworks.example |
| Manager | Hina Malik | hina@novaworks.example |
| Agent | Ali Raza | ali@novaworks.example |
| Agent | Hamza Shah | hamza@novaworks.example |
| Agent | Sara Noor | sara@novaworks.example |
| Agent | Usman Tariq | usman@novaworks.example |
| Agent | Zain Abbas | zain@novaworks.example |
| Agent | Maryam Asif | maryam@novaworks.example |

## Flow and judge test

Admin login -> Create from Transcript -> paste full meeting -> model extracts final decisions using safe employee directory -> validate roles/references/dates/positive hours -> save entire batch in one transaction -> success counts/project list -> project detail -> logout -> manager or developer sees permitted work.

After actual AI configuration:

1. Paste backend/docs/meeting-transcript.txt; expect3projects/12tasks.
2. UrbanCart: Ayesha,20October2026,4tasks; final integration19October.
3. Ayesha sees only UrbanCart. Ali sees3own tasks. Hamza sees2API tasks across UrbanCart and QuickServe.
4. Direct requests for other users' work are denied; refresh preserves saved records.
5. Modify QuickServe integration consistently to12hours/2026-10-23; verify changed output.
6. Missing required information/provider failure must save nothing and allow correction.

npm.cmd run test:live --prefix backend makes actual provider calls and has NOT been run. Requires authorized credentials/usage. Static /?preview=1 is explicitly labeled; it cannot authenticate or save. Test fixtures are never seeded into the actual demo database.

## Verification and reset

```powershell
npm.cmd run test:all --prefix backend
npm.cmd run build --prefix app/client
```

Observed:10/10 backend tests PASS; frontend build PASS. Tests cover HTTP sessions/RBAC/direct access, malformed output, wrong employees, rollback, SQLite reopen, duplicate/concurrent requests and mocked provider failure. They do not prove model correctness. Evidence: hackathon/reports/backend-integration-20261007.md.

For an intentional demo reset, stop server, run npm.cmd run reset:projects --prefix backend, then restart. This deletes generated projects/tasks/submission markers but preserves seeded users.

## Deployment and limitations

Local only; no hosted frontend/backend/database. Build output app/client/dist is served by npm.cmd start --prefix backend. GitHub is source hosting, not deployment. Actual TokenRouter execution and transcript correctness remain pending. Local-database submission requires a working-flow recording; the live demo remains mandatory. No signup/password reset/user management/costs/progress features. Full accessibility conformance not audited. Deadline13:00, freeze12:40 Asia/Karachi7October2026.

