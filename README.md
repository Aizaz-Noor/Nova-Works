# NovaWorks - Meeting to Execution

Code Nomads: Aizaz (UI/UX and integration), Abdul Basit Shahid (backend/AI), Abdullah (QA and demo evidence).

## Current status

Frontend milestone implemented. Real backend login, AI transcript conversion, persistence and request-level authorization are pending integration. This is not yet a complete challenge submission.

Stack: React19.2.8, Vite6.4.3, JavaScript, plain CSS. Planned backend: Node/Express, SQLite, server-side sessions and runtime AI. Provider/model not yet verified. Tested frontend on Node24.12.0.

## Run the frontend

```powershell
git clone https://github.com/Aizaz-Noor/Nova-Works.git
cd Nova-Works/app/client
npm.cmd ci
npm.cmd run dev
```

Keep the terminal running. Open http://127.0.0.1:5173/. Frontend requests /api via Vite proxy to backend http://127.0.0.1:3001; real login requires the backend to be running separately. Backend run/seed/schema/environment commands will be supplied by Basit's integration; they do not exist in this frontend milestone.

For design review open http://127.0.0.1:5173/?preview=1. This visibly labeled preview uses static fictional sample data. It does not authenticate, call AI, create records or prove server access restrictions. Change View as to examine manager/developer interfaces.

```powershell
npm.cmd run build
```

Build output: app/client/dist/. It is generated locally and excluded from Git. Backend may serve this build on the same origin for the final demo. Vite preview alone has no API proxy.

## Implemented frontend

Login form and API error handling; administrator transcript form; project cards/details; manager project presentation; agent My Tasks; read-only ten-person directory; loading/empty/error/success states; session reset handling; responsive layouts. Actual saved-record and AI behavior depends on the backend.

## Team contract

Read Aizaz/TEAM_BUILD_HANDOFF.md for endpoints, schemas, ownership, acceptance cases and checkpoints. UI decisions: Aizaz/DESIGN_SYSTEM.md. Official requirements: Aizaz/HACKATHON_CONTEXT.md.

## Demo accounts

All are fictional login identifiers, not email inboxes. Planned seeded password: Demo123! for each. These do not authenticate until the backend seed/session implementation is integrated.

|Role|Name|Email|
|---|---|---|
|Admin|Admin|admin@novaworks.example|
|Manager|Ayesha Khan|ayesha@novaworks.example|
|Manager|Bilal Ahmed|bilal@novaworks.example|
|Manager|Hina Malik|hina@novaworks.example|
|Agent|Ali Raza|ali@novaworks.example|
|Agent|Hamza Shah|hamza@novaworks.example|
|Agent|Sara Noor|sara@novaworks.example|
|Agent|Usman Tariq|usman@novaworks.example|
|Agent|Zain Abbas|zain@novaworks.example|
|Agent|Maryam Asif|maryam@novaworks.example|

## Verification and judge testing

Frontend build and browser preview checks passed at1440px,768px,375px. Preview shows Ayesha onlyUrbanCart; Ali3own tasks; Hamza2tasks across projects. These checks do not establish backend authorization. Evidence: hackathon/reports/frontend-milestone-20261007.md.

After backend integration, test actual admin login -> paste full official meeting ->3saved projects/12tasks -> final corrections -> role views/direct access denial -> refresh. Consistently modify QuickServe integration to12hours/2026-10-23; only that generated task should change. Test unresolved required fields/provider failure save nothing. Reset-generated-record instructions preserving users remain pending backend implementation.

## Environment and secrets

Frontend requires no environment variables or private credentials. Backend configuration/.env.example will be supplied with backend integration. Never put runtime AI keys, database credentials or session secrets into frontend variables, source or Git. .gitignore excludes private env files and local databases.

## Deployment and submission

Local frontend only. No hosted application/database; no deployment performed. Live link: not deployed. Demo video: pending working backend integration; required for local database submission. No submission performed. GitHub repository is source hosting, not application deployment.

## Known limitations

Backend not present in this milestone; normal login shows unavailable-service feedback. Live AI, persistence, server access enforcement and session-expiry backend regression are NOT RUN. Static preview is design-review data only. Full accessibility audit not run. Deadline13:00 and freeze12:40 Asia/Karachi on7October2026.
