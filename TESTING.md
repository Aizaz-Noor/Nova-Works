# Test NovaWorks yourself

Use the [public demo](https://nova-works-zeta.vercel.app), or follow the root README to run it locally at http://127.0.0.1:3001. Use normal `/`; `/?preview=1` is explicitly static.

## A useful walkthrough

All supplied fictional demo passwords are **Demo123!**. Use the login's Administrator, Ayesha or Ali role buttons to fill credentials, then choose **Sign in**.

1. As administrator, open **Team directory**. Search by name/skill, choose a role and clear the filter. Ten supplied accounts exist.
2. Open **Projects → Create from Transcript → Load sample meeting → Create projects and tasks**. Loading alone does not save. A new extraction consumes provider credits; already saved input reuses its result without a new call.
3. Inspect the sample batch: three projects and twelve tasks. UrbanCart's project deadline is 20 October 2026; integration is 19 October / 6 hours. QuickServe integration is 22 October / 10 hours. HelpDeskPro evaluation belongs to Maryam, 21 October / 8 hours. Rejected payments/maps and outsider Kamran should not become assignments.
4. Search **UrbanCart**, open the project, search **integration**, filter by its authorized assignee and change deadline ordering. Clear filters restores the permitted list. An unmatched query shows recovery rather than claiming no work exists.
5. Refresh and submit the identical sample again. Saved work remains, and the result notice says the existing batch was reused.
6. Sign out; sign in as Ayesha or Ali. Managers see assigned projects; developers see their own tasks. Other users' rows cannot be fetched directly. A clean original sample gives Ayesha one project and Ali three tasks; the shared public workspace may have additional authorized work.
7. Try a wrong password, an empty query result and incomplete meeting data. Errors should be readable, preserve useful input and allow correction. Invalid extracted work must save nothing.
8. Check a phone-width view and keyboard navigation. Labels, focus and primary actions should remain visible.

Do not delete shared public projects for rehearsal. For a separate local recording database, run `node scripts/start-recording-server.mjs` from the root and visit http://127.0.0.1:3008. It seeds fictional users into `tmp/public-demo.sqlite`, serves the same application, and makes a real provider call only when you submit a new meeting. It does not open the hosted DATABASE_URL. Sessions intentionally expire when this recording server restarts.

## Automated checks

```powershell
npm.cmd ci --prefix backend
npm.cmd run test:all --prefix backend
npm.cmd run build
node backend/scripts/verify-deployed.js
```

The public verifier checks HTTPS login, sessions, directory, saved-sample fields, duplicate replay, persistence, role restrictions, direct denials and logout. It consumes provider credits only if its sample is not already saved.

Optional private-environment checks:

```powershell
# Real PostgreSQL fixture transaction/RBAC/session/limit checks; removes only its own fixtures.
npm.cmd run test:postgres --prefix backend
# Two real provider requests against original and modified transcripts; consumes credits.
npm.cmd run test:live --prefix backend
```

Tests using a fixture provider are not evidence of live AI accuracy. Current results, tested source and known limits are recorded in [PUBLIC_DEMO_REPORT.md](docs/PUBLIC_DEMO_REPORT.md). GitHub Actions repeats the local suite, build and dependency audit.

Docker execution remains NOT RUN because Docker is unavailable in this environment. Vercel/Supabase is the verified hosted route. No event submission was made; current improvements are post-event portfolio work.