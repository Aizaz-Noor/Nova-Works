# NovaWorks ERP — current operational state

Mode: POST_HACKATHON_ERP_DEVELOPMENT
Updated:22 October2026, Asia/Karachi
Owner: Aizaz, integration owner
Direction: user-approved staged modular-monolith ERP plan; full ERP/commercial objective remains active and incomplete.
Plan: docs/erp/MASTER_PLAN.md. Coverage: docs/erp/PLAN_PROGRESS.md.
Prior detailed state preserved verbatim in docs/erp/history/RUN_STATE_20261021_BEFORE_MANUAL_TEST_HANDOFF.md.

## Current user priority

The user wants to test the current NovaWorks candidate now. Keep the running site, built client and human test database stable while they test. Do independent review/documentation without rebuilding, resetting or migrating their database. Address reported defects with concrete reproduction before changing the candidate.

Local test candidate:1cee3ca, branch codex/erp-foundation in tmp/novaworks-analysis-20261019.
This checkout is the isolated next candidate, codex/erp-notifications in tmp/novaworks-next-notifications; base69e6e3b. Do not rebuild or migrate the original human-testing checkout.
URL:http://127.0.0.1:3039, loopback only. Foreground handle60763 confirmed live; HTTP200 reverified this handoff.
Launcher:scripts/start-local-testing.mjs. Restart/checklist:docs/erp/LOCAL_TESTING_GUIDE.md.
Test data:ignored tmp/human-testing/novaworks.sqlite. Private session/MFA configuration:separate ignored tmp/human-testing/private-config.json. Preserve both; never print or stage private values.
The public demo is separate and has not received these local changes.

## Candidate capabilities and limits

Implemented locally: accounts/companies/invitations; scoped projects/tasks; CRM/pipeline; quotes/orders; time submission/review; invoices/PDF/manual payments/corrections; reviewed company-AI queue; scoped reports/exports; provisional subscription lifecycle/binding controls; company preferences; password/recovery/security history/MFA; task comments and project milestones.

This manual-test launcher uses SQLite, disables subscription enforcement and injects a disabled AI provider. No AI worker or email delivery is connected; AI jobs may remain queued. Paid checkout is absent. Do not present these disconnected workflows as live-provider acceptance. Authenticator setup is available with a private local key; real-phone interoperability remains a manual test.

Private attachments are not implemented. In this isolated checkout, task-comment notification backend020 now has125/125 tests and restricted PostgreSQL evidence; its interface has12 Edge responsive checks PASS; upgrade/restore remain open and it is absent from the human-testing site. Full ERP expansion (HR/inventory/purchasing/accounting/payroll/POS) is not started. Preserve the original plan scope.

## Verified evidence

- Last backend source regression:124/124 PASS,0 failed/skipped,exit0; tmp/milestones-recovery-backend.log,41349.2586ms. No backend change since that run.
- Latest client build:50 modules,exit0,2.91s (4a2947f interface source).
- Actual Edge role/read-only acceptance:assigned-member paging/load recovery/comment post; unassigned-record404; expired-owner controls/direct402; Reports/Subscription current-page state.8 responsive checks320–1366,zero page errors. tmp/collaboration-roles-browser-l3o37R/results.json.
- Milestone Edge create/retry/conflict-review/completion/reload/rate-limit:16 responsive checks PASS. tmp/project-milestones-browser-bnUs0e/results.json.
- Actual PostgreSQL018→019:26 populated prior tables/checksums preserved under nonbypass migrator,forcedRLS/repeated migration PASS. tmp/project-milestones-upgrade/postgres-results.json.
- Genuine local pg_dump/pg_restore:48 tables matched,30 populated; fresh restricted runtime and restored HTTP login/read/reopen/stale409/create/retry PASS. tmp/project-milestones-pgdump-BHDlqg/results.json.
- Acceptance detail/limits:docs/erp/PROJECT_MILESTONES_ACCEPTANCE.md, TASK_COMMENTS_ACCEPTANCE.md and the other module acceptance documents.

These are scoped local fixture results. Manual user acceptance is pending; no human PASS, hosted readiness or commercial readiness is claimed.

## Next actions and open gates

1. Implement the user-approved premium compact ERP UI, charts/diagrams, improved type/color/contrast in this isolated checkout; preserve the original manual-test candidate. Receive/reproduce manual-test findings while preserving test data; save fixes and reverify changed flows.
2. Continue remaining collaboration:private attachment/storage lifecycle and in-app notifications; broader access/session/load acceptance. Keep external delivery separate from in-app records.
3. Remaining core/commercial work includes granular roles/project membership, verified identity/live recovery delivery, imports, billing rates/time-to-invoice, further finance corrections/reporting, live AI/provider and merchant acceptance, monitoring and staging.
4. Hosted/cross-cluster recovery, role/key custody, object-storage recovery, PITR/RTO/RPO, real authenticator and full security/load review remain open.
5. Ownership/legal/support/pilot/pricing decisions and authorized rollout remain open. Full original ERP expansion remains required by the long-term plan.

No new remote push, deployment, hosted migration, external message or paid provider call. Do not mark the overall goal complete from local tests. Root hackathon documents/public-demo state are independent and were not replaced.


Next-candidate UI milestone22October2026: user expands scope to premium compact ERP/charts/diagrams and explicitly requests multi-agent work plus12resources. Design source review, chart read-only review and notification component ran in parallel; provenance in docs/erp/UI_RESOURCE_REVIEW.md, design in docs/erp/DESIGN.md. Report visuals and notification UI integrated; final build53modules exit0/4.12s; actual Edge reports28width checks including4synthetic boundary checks PASS andnotifications12width checks PASS, zeroerrors/overflow. See PREMIUM_REPORTS_ACCEPTANCE.md. Current outer shell still needs compact redesign;020upgrade/restore/privateattachments/fulloriginalgates OPEN. Originalhuman3039 unchanged.

Compact-shell milestone22October2026: build54modules exit0/2.87s; actual Edge shell verifier exit0 PASS10owner modules/company create/switch/security/mobile module picker/original preview and6widths320–1440,zeroerrors/overflow. Evidence tmp/erp-shell-browser-SFHalT/results.json; COMPACT_SHELL_ACCEPTANCE.md. Final premium report verifier exit0 PASS28widthchecks plus independent review/member finance403/exact totals/export; tmp/premium-reports-browser/results.json. Verifier now creates a fresh disposable database; initial rerun hit expected registration limit on reused fixture, fixed fixture isolation without changing product limits.

Notification020 populated PostgreSQL upgrade and genuine dump/restore now PASS exit0:27 prior populated tables/checksums preserved;49 restored tables/31populated matched and actual restricted restored HTTP read/comment/retry passed. See TASK_NOTIFICATIONS_ACCEPTANCE.md. Migrator must own historical comments table for index creation; runtime remains nonowner. Hosted recovery still open.

Next engineering slice: private task attachments with task-scoped metadata/RLS, bounded private storage, authorized downloads, retry/failure atomicity and combined DB+object recovery. Existing generic platform_files metadata is company-wide and must not be reused for task-private access. Original testing site remains unchanged; no rollout/push/deploy. Full ERP and commercial gates remain incomplete.

Attachment milestone22October2026: implemented private task metadata/usage021, restricted taskRLS, aggregate quota trigger, immutable private filesystem objects, authenticated download and UI. ActualHTTP1/1PASS after initial emptyusage500 fixed; actual restrictedPG020→021 PASS13populatedprior tables/checksums preserved, cross-assigneequota/retry/raw23514/auditrollback. Latest tmp/task-attachments-pg-uAyyIX/results.json. Actual browserupload/download5widths PASS, SQLite+bytes restored authenticated download PASS; final source-consistent reruns in progress. Independent review found/fixed malformedUnicode/quota/stagedpublication defects; crashlock deliberately requires documented stoppedwriter operator recovery. See TASK_ATTACHMENTS_ACCEPTANCE.md. Original3039 unchanged.
Next gate: finish final regression and save local attachment slice, then genuinePGdump/restore with real private bytes; hostedobjectstorage/scanning/retention/orphanreconciliation/staging and commercial/fullERP gates remain OPEN.
Final attachment acceptance: full backend130/130PASSexit0,97088.0147ms(tmp/attachments-backend-final.log); latest actualEdgebrowser PASSexit0 tmp/task-attachments-browser-hUCRoK/results.json; finalSQLite+privatebytesrecovery PASSexit0 tmp/task-attachments-recovery-gOfAn2/results.json. Fresh restrictedPG latestPASS tmp/task-attachments-pg-uAyyIX/results.json. Build55modules2.57s exit0. FirstHTTP500 corrected emptyusage; firstfullsuite129/130 corrected stale startupmock; finalsource reruns passed. Current next gate genuinePGdump/restore+privatebytes, then durablehostedstorage/operational lifecycle. Fullobjective ACTIVE/incomplete; originalhuman-testcandidateunchanged.

PostgreSQL+privatebytes recovery milestone22October2026: actual51tables/16populated3realobjects2companies restored, all digests and SHA256 matched; restored restrictedHTTPdownload/isolation/retry/newupload/usagecontinuity/missingcorrupt503 PASSexit0. Evidence tmp/task-attachments-restore-EbFsTa/results.json; TASK_ATTACHMENTS_ACCEPTANCE.md. ReadonlySQLite operatorinventory added; actualCLIhealthy and focusedinventory+HTTP3/3PASSexit0. No deletion/hostedrollout. Next businessslice billingrates→approvedtime→invoice; rates foundation inprogress with parallel backend/spec work. FullERP/commercial goal remainsACTIVE.
