# Testing NovaWorks

## Local checks

Install Node.js 24 dependencies from the repository root:

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix app/client
```

Run backend tests and a production frontend build:

```powershell
npm.cmd run test:all --prefix backend
npm.cmd run build
```

For an isolated browser walkthrough, run `npm.cmd run start:demo`, open `http://127.0.0.1:3048/` and select **Explore demo workspace**. The local demo uses fictional SQLite data in `tmp/` and refuses hosted database configuration. It does not send email, charge cards or call a live AI provider.

## PostgreSQL verification

PostgreSQL checks require a disposable database that you control. Configure it only in a local untracked environment file, then follow the relevant script or deployment guide. Never run destructive verification against the hosted demo. Review each verifier's setup and cleanup behavior before running it.

## What each result means

- Unit/API tests exercise the code paths represented by their fixtures and local adapters.
- A successful frontend build confirms compilation and bundling.
- Browser checks confirm only the screens and actions they actually visit.
- Deployed checks require the actual host and database; local tests do not prove hosted behavior.

No single check proves complete accessibility, security, or production readiness. Record which command ran, the tested commit, actual result and any unverified workflows.
