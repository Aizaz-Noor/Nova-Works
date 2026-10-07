# NovaWorks — AI Project Manager: Meeting to Execution

Standalone backend for Infinity Hack ’26. Converts an admin-submitted meeting transcript into validated SQLite projects and tasks, with seeded login and role-based API access.

## Team and submission

- Company scenario: NovaWorks Technologies, Lahore, Pakistan.
- Frontend contact: Aizaz. Participant names/team name were not supplied.
- Repository/live link/demo video: not supplied; no deployment performed.
- Frontend: not present in the supplied repository. This deliverable is the backend.
- A recorded demo video is still needed for a local-database submission.

## Stack

Node.js **24+**, JavaScript ES modules, Express 5, express-session, built-in `node:sqlite` (SQLite), built-in scrypt password hashing, native fetch with OpenRouter structured JSON/schema output. OpenRouter model is selected through environment configuration; no specific model is hardcoded. Choose a model that supports JSON schema.

Only two npm runtime dependencies: `express` and `express-session`. Node SQLite avoids a native npm compilation/download step. No Docker, ORM, Redis, or extra product features.

## Run on Windows

Extract the supplied archive into `E:\Hack work` so this README is at `E:\Hack work\backend\README.md`. Install Node.js 24+ first. In PowerShell:

```powershell
Set-Location 'E:\Hack work\backend'
npm install
Copy-Item .env.example .env
# Edit .env before starting; provide private values for SESSION_SECRET and OpenRouter.
notepad .env
npm run db:init
npm run seed
npm run seed
npm start
```

Both seed runs should print `10 users`. Leave the backend terminal running. The server listens on port **3001** by default. Start Aizaz's frontend in its own terminal, with its origin matching `FRONTEND_ORIGIN`. See [BACKEND_API.md](BACKEND_API.md) for fetch examples and response contracts.

For macOS/Linux or the repository checkout:

```sh
cd backend
npm install
cp .env.example .env
# Edit .env with private configuration.
npm run db:init
npm run seed
npm start
```

Generate a random session secret locally, then paste the output only into your private `.env`:
```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Environment variables

The backend loads `backend/.env` regardless of process working directory. Existing process environment takes precedence. `.env.example` contains placeholders only.

| Variable | Purpose / default |
| --- | --- |
| `PORT` | HTTP port, default `3001` |
| `DATABASE_PATH` | SQLite file, default `./data/novaworks.sqlite`; relative paths are relative to backend folder |
| `SESSION_SECRET` | Required private session signing secret, minimum 32 characters; example placeholder is rejected |
| `FRONTEND_ORIGIN` | Exact allowed browser origin, default `http://localhost:5173`; no trailing slash |
| `OPENROUTER_API_KEY` | Private backend-only provider credential |
| `OPENROUTER_MODEL` | Required provider model ID supporting structured schema output |
| `NODE_ENV` | `development` locally; `production` enables Secure cookies |
| `TRUST_PROXY` | Optional `1` only behind one trusted reverse proxy |

AI credentials never enter browser variables. Login/read APIs work without an AI key, but creation returns 503 until configured. Never commit `.env`, session secrets, API keys, or generated database files.

## Database and accounts

SQLite: `backend/data/novaworks.sqlite` in a checkout, or `E:\Hack work\backend\data\novaworks.sqlite` after Windows extraction. Schema initializes at startup or via `npm run db:init`. Foreign keys are enabled on every connection. Seed accounts explicitly before login. Repeated seeds preserve existing accounts/passwords and do not duplicate users.

Every demo password is **Demo123!**. Stored passwords are salted scrypt hashes; hashes are never returned in APIs or sent to AI.

| ID | Role | Name | Email |
| --- | --- | --- | --- |
| ADMIN | ADMIN | Admin | admin@novaworks.example |
| PM01 | MANAGER | Ayesha Khan | ayesha@novaworks.example |
| PM02 | MANAGER | Bilal Ahmed | bilal@novaworks.example |
| PM03 | MANAGER | Hina Malik | hina@novaworks.example |
| DEV01 | AGENT | Ali Raza | ali@novaworks.example |
| DEV02 | AGENT | Hamza Shah | hamza@novaworks.example |
| DEV03 | AGENT | Sara Noor | sara@novaworks.example |
| DEV04 | AGENT | Usman Tariq | usman@novaworks.example |
| DEV05 | AGENT | Zain Abbas | zain@novaworks.example |
| DEV06 | AGENT | Maryam Asif | maryam@novaworks.example |

## API overview

Login/logout/current user: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.
Read-only team: `/api/team`. Role-filtered data: `/api/projects`, `/api/projects/:id`, `/api/tasks`.
Admin extraction: `POST /api/admin/create-from-transcript` with `{ "transcript": "…" }`.

Authorization uses the server-side session and current SQLite user. The backend ignores caller-supplied authorization IDs/roles. Agents receive only their own tasks, including in project details. Validation checks the entire AI result before one atomic transaction saves all records. Identical trimmed transcripts are deduplicated persistently; concurrent identical requests get 409 while processing. Changed input creates another batch, not an update to existing records.

## Tests and judging

```sh
npm test
npm run test:api
npm run test:live
```

- `npm test`: offline core checks for seed idempotency/hashes, RBAC SQL, validation, forced rollback, persistence and provider contract with a mock. Does not require npm packages or AI credentials.
- `npm run test:api`: actual Express HTTP/session acceptance with an injected test-only fixture provider. Requires `npm install`; does not prove genuine AI extraction.
- `npm run test:live`: two real OpenRouter calls, original and modified supplied transcript; requires key/model/network and may incur provider charges. Checks exact reference assignments, dates, hours and counts, then verifies only QuickServe integration changes to 12 hours / 23 October. Uses an isolated in-memory database, leaves your demo database unchanged.

Organizer transcript: [docs/meeting-transcript.txt](docs/meeting-transcript.txt), extracted from supplied challenge PDF. Expected output in `test/fixtures/expected.json` is **only a test reference**; application source never imports it. No mock mode is available through production API requests.

For the manual demo:
1. Login as admin and submit the whole supplied transcript. Expect 3 projects, 12 tasks.
2. UrbanCart: Ayesha, deadline 20 October 2026; integration task due 19 October.
3. QuickServe: Bilal; Usman's integration estimate 10 hours, due 22 October.
4. HelpDeskPro: Hina; Maryam owns evaluation/testing.
5. Login as Ayesha: only UrbanCart. Ali: only his 3 UrbanCart tasks. Hamza: 2 API tasks across UrbanCart/QuickServe.
6. Request other projects directly: 404; non-admin creation: 403.
7. Restart backend, login again and verify records persisted.
8. Reset generated records, change all final QuickServe integration mentions (including recap) to 12 hours / 23 October and submit again. Other extracted assignments/dates/hours should remain the same.

To remove **all generated projects/tasks** while keeping demo users, stop the server and run:
```sh
npm run reset:projects
```
This also clears transcript deduplication markers so the original can be generated again.

## Verification in this build environment

- Database initialization and seed twice ran successfully: 10 users.
- Seven core tests passed, including rollback and close/reopen persistence.
- npm installation was denied by this cloud environment's outbound policy (`403` from npm registry).
- HTTP/session suite could not start because Express is unavailable here.
- Live test returned `AI_NOT_CONFIGURED`; no provider key/model is configured.

Run the HTTP and live commands above on your PC before claiming the complete demo passes. No frontend/UI or deployment was tested.

## Known limitations / deployment

Local-only delivery. No frontend, hosted database, live URL or video included. Sessions use express-session MemoryStore: appropriate for a single-process hackathon demo, lost on restart and unsuitable for multi-instance production. SQLite projects/tasks and successful deduplication survive restart. Login has no rate limiting. Keep the demo on localhost or a controlled demo host.

Production must use HTTPS and frontend/API on the same site for the default cookie policy; set `NODE_ENV=production`, private environment values and a trusted proxy setting only if applicable. Keep SQLite on persistent storage. The application does not implement editing, signup, progress, costs or user management. No deployment bonus is claimed. The provider may fail schema support, time out, hit quota, or produce semantically incorrect extraction; these surface as errors or acceptance-test failures and require retry/model/transcript correction. Validation checks structure/relationships, not whether every extracted task matches meeting intent.

Dependency versions use compatible ranges. A lockfile could not be generated because registry access was blocked; `npm install` on your PC will generate it. Keep the resulting lockfile for reproducible team installs.
