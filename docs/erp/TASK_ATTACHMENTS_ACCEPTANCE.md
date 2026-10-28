# Private task attachments — local acceptance

22 October2026, isolated codex/erp-notifications. Original human-testing site/data untouched.

## Working slice

Task attachment disclosure connects to real authenticated list/upload/download endpoints. TXT/PDF/PNG/JPEG signatures and UTF-8 are checked; maximum2MiB per file. Upload JSON is exactly requestId/name/contentBase64. Only the exact POST task-attachment path permits a3MiB envelope; existing routes retain256KiB. Trusted Origin, JSON and session requirements remain. Upload retries compare task/name/type/hash/size; a changed payload conflicts409. Company resource cap100files/32MiB is provisional operational protection, not a commercial plan definition.

New021 tables: immutable platform_task_attachments with composite task/company and creator membership FKs; platform_attachment_usage contains aggregate counts only. Forced task-access RLS limits metadata to owner/admin, assigned project manager or assigned member. A hardened-search-path security-definer insertion trigger accounts company usage atomically without exposing other tasks. Runtime gets attachment SELECT/INSERT, usage SELECT only; no UPDATE/DELETE. Audits and usage roll back with metadata. Read-only companies retain permitted downloads; uploads require projects write entitlement.

Downloads check current task access before storage reads, verify saved size/SHA256, and return attachment/no-store/nosniff. No public object URLs or bearer links. Generic platform_files remains separate. Signature checks are not malware scanning or a full document decoder.

## Storage and operation

Default storage is unconfigured and uploads/downloads fail closed503. Explicit backend PRIVATE_ATTACHMENT_ROOT enables the filesystem adapter. Use an absolute, private durable directory outside app/client/dist, source publishing and public hosting. No production/cloud adapter is claimed. Filesystem access must be restricted to the service/operator; Windows ACLs and deployment-volume durability remain operational acceptance work.

Objects use server-generated keys. Staging writes are synced before atomic hard-link publication; final objects are immutable. Failed database commits can leave bounded private orphans; retries reuse matching bytes. Disk capacity256MiB includes staged orphans. No automatic deletion or retention job exists.

A cross-process write lock fails closed on contention. Following process termination it may need operator recovery: stop all attachment-writing processes; inspect .write-lock/owner.json and verify no writer remains; preserve final objects, then remove only the stale lock. Do not remove active locks. Staged orphan inspection/reconciliation is pending operational tooling. Current tests simulate this stopped-writer procedure; no automatic stale-lock stealing is claimed.

## Actual evidence

- Focused actual HTTP test PASSexit0:300KiB actual upload (larger than ordinary256KiB envelope), exact-byte download, retry200/conflict409, no-origin/untrusted-origin403, anonymous401, peer404, ordinary-route andoversize413, reassignment withdrawal404/newassignee200. Initial500 from empty usage lookup fixed and rerun PASS.
- Actual Edge browser `node scripts/verify-task-attachments-browser.mjs`: PASSexit0; actual login/company/task upload/download exact bytes, forged PDF rejection, reload persistence,5widths320/390/768/1024/1440 nooverflow or page errors. Evidence tmp/task-attachments-browser-hUCRoK/results.json.320px screenshot inspected. Earlier component mocked-network checks were separate, not backend acceptance.
- Actual `node scripts/verify-task-attachments-postgres.mjs`: PASSexit0;020→021 preserves13 populated prior tables/checksums and repeated no-op; nonbypass migrator/fresh restricted runtime; task/usage forcedRLS, no-context/foreign/peer privacy, actual filesystembytes, retry, usage mutation42501, audit rollback, concurrent disjoint-assignment quota, raw overcap23514. Evidence tmp/task-attachments-pg-uAyyIX/results.json.98 explicit synthetic metadata rows exercise quota only; they are not real uploaded files or a recovery fixture.
- Actual `node scripts/verify-task-attachments-recovery.mjs`: PASSexit0; closed browser-fixture SQLite database and private bytes restored independently, manifest SHA256 matched metadata, fresh process authenticated/selectcompany/download exactbytes; anonymous401. Evidence tmp/task-attachments-recovery-gOfAn2/results.json. This proves local SQLite+file recovery only, not PostgreSQL/object-store disaster recovery.
- Client build55modules exit0/2.57s. Independent final source review found no critical blocker in the reviewed corrections; remaining operational gates are listed below. Full regression final result follows.

## Remaining acceptance

Genuine PostgreSQL dump/restore with private bytes; hosted private object storage and deployment wiring; scanning/quarantine policy; operational orphan reconciliation/retention/deletion/exports; real filesystem ACL/durable-volume and failure/load checks; hosted staging and human acceptance. No push, deployment or original manual-test migration. Full ERP and commercial launch remain incomplete.

Final source-consistent regression: npm.cmd run test:all --prefix backend PASSexit0,130passed/0failed/skipped,97088.0147ms; tmp/attachments-backend-final.log. Initial129/130 run used stale startup mock table inventory; added the new required protected tables and reran. Latest actual browser and recovery evidence above use final021 AFTER INSERT counter schema. Independent source re-review found no critical blocker; production/recovery limits above remain.

## Genuine PostgreSQL and private-byte recovery

Actual `node scripts/verify-task-attachments-pgdump-restore.mjs`: PASSexit0. Fresh actual source across2companies and3realobjects (no syntheticquota rows), genuine18.6 pg_dump/pg_restore51tables/16populated; all table counts/digests matched. Independent private-byte backup/manifest/restored directory hashes matched. Fresh restricted runtime HTTP login/select/list/download passed, anonymous401/unassigned404/crosscompany404, prebackupretry200/new300KiB201/retry200 and aggregate continuity. Missingobject503/corruptobject503/correctbytes200. Evidence tmp/task-attachments-restore-EbFsTa/results.json. This closes local PostgreSQL+filesystem recovery only; hostedbackup/ACL/volume/PITR/RTO/RPO remainopen.

## Read-only operator inventory

`backend/scripts/inspect-private-attachments.js --writers-stopped <absolute-existing.sqlite> <absolute-private-root> <absolute-new-report.json>` opens SQLite read-only and exclusively creates a private report outside the object root. Stop all writers first and supply the complete database. Reports missing/corrupt/unreferenced objects, stagedorphans, unsafeentries and lockpresence. No files/counters/locks are removed or changed. This is local SQLite tooling; a hosted complete authorized metadata snapshot/operator policy remainsfuture work.

Actual fixture command PASSexit0 healthy1metadata/1object/0issues. First CLI attempt failed due pathcallback argument handling, fixed before acceptance. `node --test backend/test/attachment-inventory.test.js backend/test/task-attachments-http.test.js` PASSexit0,3/3,3997.5447ms; detects malformedmetadata/missing/hashmismatch/orphan/stage/lock, exact source preservation, existingreport refusal and realHTTP coreflow. No appsource change since full130/130 backend suite; new operator tests are focused acceptance, not a new full-suite claim.
