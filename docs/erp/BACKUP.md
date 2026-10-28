# SQLite backup and restore

Run Node.js 24 from the repository root. Supply both paths explicitly; the destination directory must already exist and the destination file must not exist.

```powershell
node backend/scripts/backup-sqlite.js "E:\NovaWorksData\app.sqlite" "E:\NovaWorksBackups\app-2026-10-19.sqlite"
```

Success prints only page count and check results, exits 0, and means SQLite `integrity_check` and `foreign_key_check` passed on the resulting backup. The script uses the [Node SQLite online backup API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html#sqlitebackupsourceDb-path-options), which includes committed WAL data while the source remains open. It opens the source read-only, exclusively reserves a new destination, and never deletes or overwrites existing files. A failure exits 1; any newly created destination must be treated as unverified. Retry with a different new filename after resolving the failure.

Store backups in a private directory outside the repository and web root, with encrypted off-device copies and an explicit retention policy. Backups contain authentication hashes, sessions, transcripts and company records. Protect them like the application database. Files held outside SQLite require their own coordinated backup.

## Restore drill

1. Keep the live source untouched. Select a verified backup and a fresh isolated directory.
2. Copy the backup into that directory using a copy operation that refuses an existing destination. Never copy onto an open database or its WAL files.
3. Open the restored copy with the same app revision and configuration. Run integrity and foreign-key checks, then verify expected organization, user, project and task records and login/role access in the isolated app.
4. Record backup time, restored revision, record counts, integrity results and observed user flow. Stop the isolated app after the drill.

`node --test backend/test/backup.test.js` performs an automated local drill: seeded demo and platform organization -> live online backup -> fresh restored file -> exact users/projects/tasks/platform record comparisons plus integrity/foreign-key checks. It also verifies overwrite rejection, missing-source protection and CLI behavior. This is local SQLite evidence; it does not establish production backup retention, off-device recovery or PostgreSQL restoration. PostgreSQL deployments need provider backups/PITR and a separate staging restore drill before launch.
