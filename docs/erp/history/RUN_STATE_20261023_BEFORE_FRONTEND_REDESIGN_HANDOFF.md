# NovaWorks ERP — current operational state

Mode: POST_HACKATHON_ERP_DEVELOPMENT
Updated:22 October2026, Asia/Karachi
Owner: Aizaz, integration owner
Direction: user-approved full modular-monolith ERP launch plan and premium compact responsive UI, with parallel agents. Full objective ACTIVE and incomplete.
Plan: docs/erp/MASTER_PLAN.md. Coverage: docs/erp/PLAN_PROGRESS.md.
Prior state preserved verbatim: docs/erp/history/RUN_STATE_20261022_BEFORE_RATE_FOUNDATION.md (and earlier history files).

## Protect human testing

Original checkout tmp/novaworks-analysis-20261019, codex/erp-foundation; code candidate1cee3ca. Local human URL http://127.0.0.1:3039. Preserve its existing build, tmp/human-testing/novaworks.sqlite and private-config.json; never print or stage private values. No migration/rebuild/reset of that checkout in these milestones. Local launcher disables AI provider/worker/email/checkout and subscription enforcement. Process liveness was not rechecked this milestone; do not infer it from this file.

All new work is isolated in tmp/novaworks-next-notifications, codex/erp-notifications. Original/public demo has not received these changes. No push, hosted migration, deployment, external messaging or paid provider call.

## Current implemented capabilities

Accounts/companies/invitations and scoped delivery; CRM/pipeline; quotes/orders; actual-time submission/independent review; order-sourced invoices/PDF/manualpayments/corrections; reviewed AI queue foundation; scoped reports/exports; subscription lifecycle/binding controls; company preferences; password/recovery/security history/MFA; comments, milestones, private task attachments and recipient-scoped comment notifications.
Compact shell/report charts/diagrams use actual scoped values with exact monetary arithmetic. New hourly project billing rates support customer-linked USD/GBP/PKR, owner/admin finance visibility, versioned amount/active changes and idempotent creation. Timesheets includes rate editor with ordinary decimal currency input and conflict recovery.

TIME invoices now connect independently approved billable entries to immutable allocations and rate/minute snapshots, preview/create/issue/PDF/manualpayment/correction. Full credit does not release time; replacements reuse original snapshots. Exact per-entry HALF_UP arithmetic and duplicate billing protection are locally verified. See TIME_INVOICES_ACCEPTANCE.md and TIME_BILLING_SPEC.md.

## Verified evidence

- Latest full backend:145/145 PASS,0failed/skipped,exit0,113961.7978ms; tmp/time-billing-backend-final.log.
- Latest client build:57modules,exit0,7.91s. Actual Edge rate create/lost-response retry409explicitreview/deactivate/reload:5widths320–1440 PASSexit0,zeroerrors/overflow. tmp/billing-rates-browser-8ndvss/results.json;390px screenshot inspected.
- Rates focused HTTP/service/helper/time/startup:10/10 PASSexit0; rate service3/3 incl entitlements/read-only; actual PostgreSQL021→022 preserves10populatedprior tables/checksums/repeatnoop and fresh restricted runtime privacy/CAS/audit/FK PASS. tmp/billing-rates-pg-BQfOiT/results.json. Migrator must own historical platform_project_customers for reference-index creation. See BILLING_RATES_ACCEPTANCE.md.
- Private attachment actual browser/HTTP/service/RLS+quota acceptance; genuine local PostgreSQL18.6 dump/restore51tables/16populated/3realprivateobjects/2companies, exact table digests+bytesmanifest and restored restrictedHTTPdownload/retry/newupload/missingcorrupt503 PASS. tmp/task-attachments-restore-EbFsTa/results.json. Local SQLite+files recovery and read-only operatorinventory also PASS; see TASK_ATTACHMENTS_ACCEPTANCE.md.
- Notification020upgrade27populatedprior tables/checksums and genuine PostgreSQL49table/31populated restoredHTTP acceptance PASS. See TASK_NOTIFICATIONS_ACCEPTANCE.md.
- Compact shell10owner modules/6widths and report28widthchecks with exact totals/member403/export passed; see COMPACT_SHELL_ACCEPTANCE.md and PREMIUM_REPORTS_ACCEPTANCE.md.

These are scoped local fixtures, not hosted readiness, human acceptance or whole-app accessibility claims. Existing migration SQL remains immutable once applied; development022 fixtures created before finalSQLiteguards are superseded, use fresh disposable fixtures.

## Next gates

1. Save verified TIME invoice milestone; next engineering priority company member lifecycle/project membership and bounded permissions, with current-session revocation and historical authorship preservation. Further finance partial-allocation/adjustment/localization remains required.
2. Genuine populated023 local restore now passes; broader roles/session/load, hosted private storage/scanning/retention/orphan reconciliation and operational lifecycle remain open. Filesystem upload crashlock fails closed; only documented stopped-writer operator recovery, no automatic stale-lock stealing.
3. Verified identity/live recovery delivery, granular roles/project membership/member lifecycle, imports, further finance corrections/reports, actual live AI/worker and merchant/billing acceptance, monitoring/staging remain open.
4. Hosted/cross-cluster recovery, key/role custody, object-store recovery/PITR/RTO/RPO, authenticator and security/load acceptance remain open.
5. Ownership/legal/support/pilot/pricing decisions and authorized rollout remain open. Full ERP expansion HR/inventory/purchasing/accounting/payroll/POS has not started and remains required by the original plan.

Portable local PostgreSQL last verified ready:foreground39509/PID2152,127.0.0.1:55439. Inspect actual process/handle before reuse; do not restart solely after observation timeout. Credentials remain private in original ignored pg-portable folder.


Latest time-invoice evidence:023 SQLite populatedgraphupgrade+injectedfailure rollback+repeat PASS; actualPG22populatedprior tables/checksums preserve/runtimeRLS/2serviceretry-overlap/auditrollback/creditreplacement PASS tmp/time-billing-pg-83U0yC/results.json. ActualEdgefullworkerlog→submit→independentreview→preview15002→lostresponsecreate/retry→issuePDF→creditreplacement retains90min/10001rate acrosscurrentrate25000;5widths320–1440zeroerrors/overflowPASS tmp/time-invoice-browser-1bzPiR/results.json. PDFtext90min/rate/workdate/totalassertionsPASS. GenuinePG54tables/24populatedrestoredsnapshot+HTTPbothsources/newtime33333/retry/isolationPASS tmp/time-billing-pgdump-eLpbOU/results.json. See TIME_INVOICES_ACCEPTANCE.md. Originalhuman3039 unchanged; fullERPgoalACTIVE/incomplete.

Member-access prerequisite22October2026: parallel memberreview agents failed due accountusage limit before work; primaryagent inspected source and removed unused membership UPDATE/DELETE runtime privileges. Startup now rejects such grants. Focusedstartup/runtime/foundation9/9PASSexit0; actualfreshrestrictedPG onboarding/invite/accept/projectreads +rawselfpromotionUPDATE42501/delete42501 +foreign403 +unsafegrantstartupreject/reprovisionPASS tmp/membership-grants-pg-giFIJ9/results.json. See MEMBER_LIFECYCLE_SPEC.md. No suspension/roleeditor/projectmembership implemented yet. Next gate prove suspendedcompany-access RLS design withoutrecursion/bootstrapbreakage, then implement versioned lifecycle+UI. FullgoalACTIVE; originalhuman3039 unchanged.

Membergate proof22October2026: primaryagent actualdisposablePGprototype PASSexit0, restrictiveactivegate policies41tenanttables/nonbypassgateowner/FORCERLS/no recursion; normalcompanybootstrap and activeprojectread; tokencontextabsent invitationhidden, matchingtoken+emailbootstrapaccepted; administrativefixturesuspend blockscompanyprojectread/taskINSERT42501 whileothercompanyworks; ownmembership/gate metadata only; reactivation restoresread. Latest tmp/member-gate-prototype-RpecRO/results.json. No application024/statusAPI/editor yet. Next implement verifiedgate mechanism asforwardmigration+controlledtransition+appsession/worker integration andUI; guardbillinglockordering. Existing145/145fullapplicationtest evidence unchanged; this milestone changes onlyproofscript/docs. FullgoalACTIVE/incomplete, nohostedchanges.


## Member lifecycle integration in progress — 22 October2026

Forward024 schema, controlled transition service/API, fresh active membership checks, assignment exclusions and member editor integration are now source changes, not feature acceptance. Small milestone: actual node --test backend/test/tenant-foundation.test.js backend/test/company-ai.test.js backend/test/timesheets.test.js PASS15/15 exit0 (2871.8516ms). Core smoke exercised fresh onboarding/invites/two-company delivery, controlled suspension denial, restart persistence, AI reviewed approval and time flows. Initial run14/15 exposed obsolete hard-delete revocation fixture; replaced with real suspension preserving membership identities. Source syntax checks passed. Actual PostgreSQL and browser/editor acceptance remain NOT RUN for024; dedicated guard-role provisioning/upgrade and restore require verification before checkpoint. Local PG exact portable process10380/session58662 started after absent process/refused port, now crash recovery; do not duplicate restart. Original3039 checkout/build/data untouched. Next gate: lifecycle authorization/rollback/worker fencing tests, actual PostgreSQL policies/function/concurrency and browser recovery, then migration preservation/restore. Full ERP goal ACTIVE/incomplete.

Lifecycle focused acceptance: node --test backend/test/member-lifecycle.test.js PASS4/4 exit0,45643.9633ms. Real service/HTTP checks cover bounded transitions, stale-version race, suspended A/active B, retained comment/task authorship, blocked reassignment/invitation bypass, atomic audit+gate rollback, read-only subscription security changes with unchanged seat count, in-flight AI finalization rejection and suspended proposed-assignee approval rejection. Existing authenticated HTTP session gets403 for company projects/tasks/reports/notifications/admin but global account and companyB200; reactivation restores companyA selection. Client build58modules PASS exit0,4.22s; this is compilation, browser editor acceptance still pending. PG recovery remains live same session58662 with fsync progress180s, no restart. Next actual editor/browser and PG upgrade/role/concurrency.


## Compact working-screen refinement — 22 October2026

User approved shorter working screens, consistent controls/typography and compact mobile invoices. Team administration/directory/invitations moved from delivery into Settings; task description/discussion/files use an expandable detail row; member editor rows disclose on demand. Invoice detail now puts customer/status/total/balance/PDF first, uses a semantic saved-items table and collapses billing metadata/payment entry/history/corrections. Shared scoped control rhythm, textareas, 44px targets and legible disabled states added; mobile form controls retain16px text. No backend policy or financial mutation handler changed for this UI pass.

Actual node --test backend/test/invoicing.test.js backend/test/time-billing.test.js backend/test/member-lifecycle.test.js PASS14/14 exit0,5450.865ms (tmp/compact-ui-core.log): source/retry/immutable invoice/payment/credit replacement, exact time allocation/roles/subscription, real existing-session company403/othercompany200/reactivation HTTP smoke. Earlier clientbuild58modules PASSexit0,5.77s; finalbuild after member-row/CSS refinement PASSexit0,58modules,2.60s. git diff --check PASS (line-ending warnings only). Fresh rendered-browser acceptance NOT RUN: browser URLpolicy explicitly rejected access; do not bypass through another browser/API surface. Earlier screenshots predate this pass and cannot prove its appearance. Next gate: user-visible preview refresh and actual desktop/mobile/keyboard flow acceptance once permitted; previous browser verifier selectors need alignment with Settings/disclosure navigation. Full ERP objective remains ACTIVE/incomplete, original3039 preserved.


## Professional frontend/dashboard redesign — authorized 22 October2026

User explicitly invokes aizaz-engineering and prioritizes frontend/dashboard improvement before further ERP feature expansion. Required routing checked against current collaboration catalog and personal engineering-os/model-routing.json: Astra/high planning task /root/aizaz_architect dispatched; implementation not started for this redesign pending saved plan docs/erp/FRONTEND_REDESIGN_PLAN.md. Preserve all prior uncommitted work. Current frontend rollback copies (including compact working-screen pass) saved under ignored tmp/frontend-redesign-baseline. Existing docs/erp/DESIGN.md and this state remain the context rather than generating duplicate .engineering files. Scope: professional service-business CRM/ERP shell, coherent typography/forms/data surfaces and role-aware useful overview from actual scoped APIs, no invented trends, revenue, accounting or unsupported backend data. No dependency install, paidcall, remote migration/deploy/push. Prior browserURLpolicy rejection remains a verification boundary; no alternate browser/automation bypass. Next: inspect and accept Astra-reviewed plan, bounded Luna workers, independent Sol verifier, record PASS/FAIL/NOT RUN.


## Frontend redesign implementation — 23 October2026

Astra/high planning completed and saved docs/erp/FRONTEND_REDESIGN_PLAN.md; implementable with no unresolved critical implementation assumption. Native customagentrole selectors became available; current tasks use aizaz-worker (Luna/high) for frontend_shell and frontend_overview, and aizaz-verifier (Sol/high) for independent verification. Earlier planning was actual explicit Astra/high task beforecustomroleselector availability, not a proseprofile switch. Shell owns App/Organization/erp-shell CSS; overview owns OverviewWorkspace/model/tests/insightsCSS/ReportWorkspace/Visuals; verifier owns only evidence/optionalstaticverification. Parent alone state/docs/integration afterhandoff. Scope and protected3039 unchanged. Overview uses actual existing role-scoped report APIs and exact values; browser URLpolicy remains explicit renderedacceptanceBLOCKED. Next gate: integrateworkers, finalbuild/helper+APIchecks, independentreview, focusedrepairs, localpreviewwithhonestvisualpendingstatus. Full ERP remainsACTIVE/incomplete.

Independent baseline regression check23October2026: verifier actual node --test backend/test/reports.test.js backend/test/invoicing.test.js backend/test/time-billing.test.js backend/test/member-lifecycle.test.js PASS16/16 exit0,15819.1349ms; log tmp/frontend-redesign-api.log. Real disposableSQLite/service+HTTP proof covers reportscope/exactaggregates/invoice/time/membership; not newfrontendruntimeorPostgreSQLacceptance. Workers stillimplementing; next combinedbuild/overviewhelpers/source+staticreview. No renderedclaim.
