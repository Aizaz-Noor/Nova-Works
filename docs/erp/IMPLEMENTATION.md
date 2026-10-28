# NovaWorks ERP implementation and release evidence

User-approved source: [master plan](MASTER_PLAN.md), 19 October 2026.
Baseline: cef75b694b7438d485fdcdfbf0eeed4e0828f323. Development branch: codex/erp-foundation.

## Product decisions

The target is the complete staged roadmap, beginning with a service-business ERP:
organization onboarding → CRM → projects/tasks → approved time → quotes/invoices
→ reports → subscriptions. HR, inventory, purchasing, accounting, payroll and POS
remain later releases with their own business specifications and verification.
The current work does not establish commercial readiness or completion of those modules.

Keep the modular monolith, parameterized SQL, cookie sessions and existing interface.
No framework rewrite, new paid service, production database migration, deployment,
outbound invitations or payment activation has been performed.

## Plan analysis

- The dependency order is sound. Tenant boundaries and recovery must precede private pilots.
- Treat 65 screens as a rough inventory, never a delivery metric. Release complete workflows.
- Eighteen two-week sprints total 36 weeks, roughly nine months; reconcile with the
  wider 8–12 month estimate using team availability, pilot feedback and actual throughput.
- Move the existing AI review safeguard into the first milestone rather than waiting
  until sprint 12. Business records should not become authoritative merely because JSON validates.
- Make a restored backup, restricted PostgreSQL runtime identity and real database
  isolation tests release gates, not documentation-only tasks.
- Recruitment of design partners can start before a full commercial release. Claims
  must match working modules; do not advertise accounting or payroll compliance prematurely.
- A provider-neutral billing adapter can be built locally; merchant approval and live
  payment activation require the owner's account and explicit release authorization.
- Ownership/contribution agreements require the human contributors. Code cannot resolve them.

## Milestone 1 acceptance

1. Preserve the public demo and use a separate development branch.
2. Apply checksum-tracked additive migrations without deleting legacy records.
3. Register a private identity; create/select an organization; invite/join a member.
4. Resolve organization membership from the authenticated session for each operation.
5. Alpha Digital: 2 members / 3 projects; Beta Consulting: 3 members / 2 projects.
6. Reject cross-company reads, mutations, guessed references, assignments and exports.
7. Enforce PostgreSQL isolation with a non-owner, non-BYPASSRLS runtime role.
8. Persist authorized records through backend restart; test backup restoration.
9. Demonstrate the same behavior through the browser, including errors and narrow screens.

## Launch gates requiring human/external evidence

Commercial ownership terms; approved product name and legal entity; real email sender
and verification/recovery; MFA/step-up; staging and production infrastructure; private
storage; merchant onboarding; privacy/terms/subprocessor review; restore drill; security
review; monitored pilot; support process; explicit controlled production promotion.

None of these gates is satisfied merely by adding a route, table, document or passing mock.

## Verification log

- Baseline backend: `npm.cmd run test:all --prefix backend` exit 0, 39/39.
- First integrated UI build: `npm.cmd run build --prefix app/client` exit 0.
- Focused HTTP core/login: `node --test backend/test/api.test.js backend/test/login-limits.test.js`
  exit 0, 7/7. Tests exercise HTTP requests against SQLite with fixture AI output.
- Foundation service isolation: specialist reports 4/4; parent integration verification pending.
- AI review/concurrency: specialist reports 3/3; parent integration verification pending.
- Real local PostgreSQL RLS and restricted-role HTTP acceptance PASS; live AI, production deployment and commercial launch remain unverified.

The roadmap remains active beyond milestone 1. Update this file with actual evidence,
limitations and remaining work; never mark an entire release complete from narrow tests.

## Milestone work-package status

| ID | Current evidence | Status |
|---|---|---|
| NW-001 | Separate checkout at baseline cef75b6; baseline39tests; original demo retained | PASS |
| NW-002 | Human contribution/ownership agreement required | OPEN |
| NW-003 | Imported plan, scope analysis, tenant schema and acceptance specifications | PASS for foundation |
| NW-004 | codex/erp-foundation and local development/test environments; hosted staging not created | PARTIAL |
| NW-005 | Checksummed additive migrations with rollback/drift tests | PASS locally |
| NW-006 | Organizations, memberships, invitations, audit and tenant projects | PASS locally |
| NW-007 | Explicit idempotent demo snapshot preserving original tables/fields | PASS locally |
| NW-008 | Trusted session organization, per-operation membership check | PASS locally |
| NW-009 | Forced PostgreSQL RLS, restricted runtime role, raw query isolation test | PASS locally |
| NW-010 | API/service tests and real PostgreSQL two-company acceptance | PASS locally |
| NW-011 | Working company creation/selection, membership and project APIs | PASS locally |
| NW-012 | Browser registration and manual token invitations; verified email/recovery not implemented | PARTIAL |

This is a local engineering milestone, not a launch approval. Subsequent business modules remain required by the original objective.

## Verified integration checkpoint, 20 October 2026

- Full backend suite:64passed,0failed,exit0.
- Client build:exit0.
- Real Edge browser company registration/create/select/project/status/refresh/login:PASS,1366/768/375/320,no uncaught errors.
- Real Edge AI fixture review:PASS,zero records before approval,human correction persisted,3projects/12tasks after approval,server search,1366/375/320 no overflow. No live AI call.
- Real local PostgreSQL18.4:PASS,restricted runtime provisioning,raw RLS reads/writes/composite FK/context reset; Alpha2members3projects/Beta3members2projects; invitation replay rejection; HTTP session restart; legacy3projects12tasks snapshot preserves fields.
- The extended PG check caught and fixed date-only timezone conversion. Failed copies were confined to disposable databases; final rerun PASS.
- Source formatting check:git diff --check exit0.
- PostgreSQL production restore drill,real-provider semantic evaluation,hosted staging and commercial readiness remain OPEN.

## Operational tasks slice,20 October2026

Implemented company-scoped task assignment and paginated task lists. Owners/admins may manage company tasks; managers assign only within their projects; members see and change only their assigned task statuses. Task ownership, dates and finite positive effort validated; changes audited. Company UI is connected to these APIs. Focused SQLite service+HTTP2/2 PASS; real PostgreSQL runtime acceptance PASS; actual Edge create/status/reflow PASS. Commercial CRM,timesheets,finance and remaining roadmap modules still pending.

## Connected CRM slice — 20 October 2026

Implemented company-scoped customers with ownership, lifecycle states, versioned edits,
paginated search, contacts, activity history and links to existing projects. Managers
edit only relationships they own; ordinary members have no CRM access. Additive migration
004 preserves the applied 002/003 checksums. The runtime requires forced RLS on all four
new tables, and its history grants permit only SELECT/INSERT for activities and audits.

| Check | Actual result |
| --- | --- |
| Full backend suite | Exit 0; 68 passed, 0 failed |
| Client build | Exit 0 |
| Real PostgreSQL runtime | CRM flow, raw RLS, tenant/role denials, concurrent edit conflict and restart persistence pass |
| History permissions | Runtime activity rewrite and audit deletion attempts rejected |
| Edge browser | Create/edit, real 409 recovery, contacts, notes, project link, search, refresh and keyboard focus pass |
| Reflow | Customer detail and list checked at 1366, 768, 375 and 320 px; no document overflow or uncaught errors |
| Existing SQLite upgrade | Existing row counts and earlier migration checksums preserved |
| CRM backup restoration | Fresh restore matches all rows across 11 business tables; integrity and foreign keys pass |

Commands: `npm.cmd run test:all --prefix backend`, `npm.cmd run build --prefix app/client`,
`node scripts/verify-local-postgres.mjs`, `node scripts/verify-crm-browser.mjs`, and
`node scripts/verify-crm-restore.mjs backend/data/erp-development.sqlite`.

One concurrent browser/backend-suite run timed out on a contact click; its original
result is retained. A sequential rerun passed without a product workaround. This does
not establish performance under load. [Acceptance](CRM_ACCEPTANCE.md) and [specification](CRM_SPEC.md)
describe the checks; generated artifacts remain in ignored `tmp` folders.

Imports remain unimplemented. Leads/deals, default stages and quote-to-sales-order conversion are implemented in the milestones below.
The full ERP objective remains active, and commercial launch gates remain open.


## Leads and deals milestone - 20 October 2026

Company pipeline now connects a qualified lead to a prospect customer/contact and deal, then a Won deal to a customer-linked delivery project. Both conversions are transactional and replay-safe. Search/filter/pagination, follow-up dates, ownership checks, optimistic conflict recovery, immutable terminal deals and audited mutations are included. Potential value uses exact integer minor-unit strings with USD/GBP/PKR; it is not booked revenue.

Validation on the local candidate: backend71/71 PASS exit0; money helpers3/3 PASS exit0; integrated clientbuild exit0. Actual Edge workflow PASS including real409 draft recovery, qualification, conversion retries, exactUSD1250.50, Proposal/Won, immediate project visibility and refresh. Lead/deal list/detail at1366/768/375/320 had no document overflow or uncaught errors; inspected narrow deal screenshot. Two earlier verifier attempts failed due test selector/disclosure handling, corrected in the verifier; no product acceptance was claimed from those attempts.

Real PostgreSQL18.4 restricted-runtime flow PASS: concurrent lead conversion returns one saved conversion and one replay; concurrent Won-project creation returns the same project; company/member/no-context RLS denials and restart persistence pass. Separate upgrade proof uses a NOSUPERUSER NOBYPASSRLS migration owner with two existing companies:10defaultstages seeded, oldchecksums retained, forcedRLS restored and rerun idempotent.005 temporarily removes FORCE from organizations under the migration table lock inside the transaction to seed all existing companies, then restores FORCE; runtime grants remain restricted. Demo backfill explicitly seeds stages too.

OnlineSQLite backup/freshrestore PASS matches all rows in15checkedtables including leads,deals and deliverylinks; integrity/FKs pass. Source fictional test database has no tasks/activities, so priorCRM/task evidence remains separate. Generated results: tmp/pipeline-browser/results.json, tmp/postgres-checks/results.json, tmp/pipeline-upgrade/results.json, tmp/pipeline-restore-O8Bw6n/results.json. FullERP/commercial launch remains incomplete. No push/deployment/providercall.


## Quotations and sales orders - 20 October 2026

A deal or direct customer now leads to an itemized quote draft, issued snapshot, recorded customer approval and immutable sales order. Issued terms/items are protected in both API and database triggers. Revision creates a new draft and supersedes the prior terms; acceptance is restricted to owners/admins with an evidence reference and current version. No external customer identity verification or message is implied. Exact BigInt minor-unit arithmetic calculates totals and per-line rounded tax. Order conversion preserves the approved quote version and exact header/items; retries and concurrent requests reuse one order.

Migration006 adds four forced-RLS tables without changing002-005checksums. Restricted-runtime PostgreSQL18.4 acceptance covers sales APIs/tenant boundaries/immutability/concurrent revisions and conversions/restart; populated prior-company upgrade using nonbypass migration credentials PASS. Backend75/75 and build PASS; actualEdge coreflow,real409 draft recovery,revision/oldacceptance denial,customer snapshot preservation,refresh/direct customer picker and16viewportchecks PASS. OnlineSQLite freshrestore matches19tables/integrity/FKs. See [spec](QUOTES_SPEC.md) and [acceptance](QUOTES_ACCEPTANCE.md). Preview3022 uses an isolated fictional database. FullERP and commercial launch gates remain open; timesheets are next in the master-plan schedule.


## Timesheets and independent approval - 20 October 2026

Company members can now record whole minutes against permitted projects/tasks, submit their own time, and receive an independent manager/admin decision. Drafts are private; rejection/resubmission retains append-only decision history. Submitted content is frozen; approved/discarded entries cannot be edited. Creation request keys prevent duplicate retries, and worker/day row serialization enforces the1440minute cap across application connections. Filtered minute and approved-billable summaries share the same role/company/date/status scope as list rows.

Migration007 adds two forced-RLS tables and a composite task/project reference index. Runtime time history is SELECT/INSERT only; entries have no DELETE privilege. Database triggers protect identity,version,state and submitted/approved content. Backend78/78 andbuild PASS; actualEdge worker->manager rejection/resubmission/approval,real409draftrecovery,requestreplay,refresh,summary and20viewport checks PASS. PostgreSQL18.4 actualruntime/concurrency/cap/immutability/tenantdenials/restart PASS; nonbypass existingdata upgrade preserves002-006checksums/businessrows; onlineSQLite21tablerestore PASS. See [spec](TIMESHEETS_SPEC.md) and [acceptance](TIMESHEETS_ACCEPTANCE.md). Localpreview3023; no push/deployment/providercall. FullERP/launchgates open. Rates,invoice linkage and correction ofapprovedtime remain futurework; invoicing is next in the master-plan schedule.


## Controlled client invoicing - 20 October 2026

Accepted salesorders now produce replay-safe full invoice drafts. Issuing assigns a sequential companyINVnumber and freezes copied amounts/items/terms plusbillingdetails. Owner/admin-only payment evidence uses exact minor-unitstrings,requesthashes,receipt uniqueness,currency/overpayment checks and versionlocks. Corrections append reversal records or full unpaid credits with sequentialCNnumbers; a credited invoice can produce one replacement draft/newnumber while preserving the original. Payments/credits/history are immutable; these records do not charge orrefund money. Timesheets are not yet priced orlinked to invoices.

Migration008 adds five forcedRLS tables without changing002-007SQL. Runtime history is SELECT/INSERTonly; invoice/counter UPDATE narrowly granted. PostgreSQL creation uses a scoped advisorylock rather than widening immutable salesordergrants; sharedinvoice readlocks keep financial snapshots consistent. PDFKit0.20.2 is pinned/lockfile-backed andinstalled withscriptsdisabled. PDF exports support basicLatintext initially; unsupportedUnicode remains online and receives explicit422 from export.

Finalbackend81/81/build PASS. ActualPostgreSQL18.4 concurrency/numbering/ledger/runtimemutationdenials/PDFauth/RLS/restart PASS. Nonbypass008upgrade preserves15populatedpriortables andchecksums; onlineSQLite26tablerestore PASS. ActualEdge source->issue->payment/overpay->reversal/fullcredit->replacement/settlement,409recovery/search/refresh/PDFdownloads and24viewportchecks PASS. Nine renderedPDFpages (1invoice,1credit,7longinvoice) have text/margin/itempairing checks andvisual review. See [spec](INVOICING_SPEC.md) and [acceptance](INVOICING_ACCEPTANCE.md). Localpreview3024; no push/deployment/bank/provider call. FullERP remains incomplete: partialcredits/refunds,rate/timebilling,globalPDFfonts,commercialAI/subscriptions and launchoperations remain open.


Company AI review checkpoint20October2026: company-onlydurablejobs,explicitleasedprocessing,editablehumanreview,atomicproject/taskapproval andUTCcompanyattemptcap nowimplemented. Backend85/85/build,restrictedPGHTTP/concurrency/RLS/restart,009nonbypassupgrade,28trackedtableSQLitebackuprestore andEdge16viewport/coreflows PASS. See [acceptance and limits](COMPANY_AI_ACCEPTANCE.md). Preview3025 is explicitly a simulatedproviderfixture; no paidcall/deployment/push. Automaticworkers,rejection/discard/retention,autosavededits,realprovideracceptance andcommerciallaunch remainopen.


Company AI worker/lifecycle20October2026: dedicatedrestrictedidentityworker nowautomaticallydrainscompanyqueue toREVIEW,with3crashattemptlimit/noautomaticfailedprovidercalls. Versioneddiscard fenceslateworkers; acknowledgedclosedcontentremoval preservesdelivery/audithistory. Correctedlistserializertranscriptleak. Backend88/88,finalfocused8/8/build,restrictedPGworker/HTTP,010upgrade17populatedpriortables/002-009checksums,SQLite28trackedtablerestore andEdge32viewport/separateworkerprocess/restart/coreflows PASS. See [worker acceptance and operation](COMPANY_AI_WORKER_ACCEPTANCE.md). Workerdisabledbydefault; fixtureonly/no paidcall/deployment/push. Nextreports; autosavededits/retentionpolicy/recoveryMFA/billing/launchoperations remainopen.


Reports20October2026: role-scopedcurrent sales/delivery/invoice-payment summaries andcontrolledJSONexports implemented withSQLexactaggregates andconsistentPostgreSQLsnapshots. Backend90/90,focused2/2/build,restrictedPG/concurrentcommit,Edge24viewports/filter/actualdownload/largeexactvalue/memberaccess/companyreset andSQLite26trackedtablerestore PASS. See [report acceptance](REPORTS_ACCEPTANCE.md) and[original-plan coverage](PLAN_PROGRESS.md). Preview3026disablesprovider. No push/deployment/paidcall. Nextprovider-neutralsubscriptions/entitlements/settings; originalremainingmodulesandreleasegatesnotnarrowed.


Subscriptionfoundation20October2026: opt-in011subscription/eventRLSschema,trial/grace/readonlyderivation,atomicseatlimits/modulefeatures/AIallowance,rawPaddleHMAC+binding/dedupe/order/tie handling andadminUI implemented. Backend96/96/focused6/6/build43modules,actualrestrictedPGbilling+legacycore,011upgrade17populatedpriortables/002-010checksums,SQLite30trackedtablerestore andEdge28viewports/state/replay/readonly/export/companyreset PASS. See [subscription acceptance and activation limits](SUBSCRIPTIONS_ACCEPTANCE.md). Preview3027testpolicyonly; no realprovider/checkout/charge/deployment/push. Nexttrustedprovisioning/reconciliationandcompanysettings; fullERP/launchgatesnotcomplete.


Billing recovery20October2026:012 durable provider lookup receipts/leases and provider revisions, Owner-only verified linking/reconciliation/canceled binding replacement, safe retries and scoped periodic runner implemented. Backend103/103/build43modules PASS; restricted PostgreSQL HTTP concurrency/RLS/restart PASS;012 nonbypass upgrade preserves19 populated prior tables and002-011 checksums PASS. Actual Edge owner linking/outage same-request retry/canceled recovery/replacement/refresh and16viewport checks PASS;375px forms visually inspected. FreshSQLite31trackedtable restore PASS with subscriptions/operations/delivery populated, finance/AI empty. Disabled CLI/daemon refuse startup with exit1 as expected. See docs/erp/BILLING_RECOVERY_ACCEPTANCE.md. Provider responses fictional/injected; no actual Paddle/checkout/charge/push/deployment. Next company settings and remaining plan gates; full ERP/commercial release incomplete.

Company preferences checkpoint: final backend npm.cmd run test:all PASS105/105 exit0; finalclientbuild44modules PASS exit0; finalEdge settings/409draftrecovery/persistence/newquotePKR and8viewportchecks PASS exit0 zeroerrors/nooverflow. Invoice snapshot focused5/5 PASS; restrictedPG/013upgrade/32tablerestore evidence above. See docs/erp/COMPANY_SETTINGS_ACCEPTANCE.md. Remaining numbering/security/integration/global-localization requirements preserved; next priority security/recovery and operational launch readiness. Local only.

Password/session checkpoint21October2026: final full backend106/106 PASS exit0 and restored-session regression1/1 PASS; clientbuild45modules andactualEdge password error/retry/signout/401/4viewports PASS with375px visuallyreviewed. Prior restrictedPG verifier PASS covers credential update/rolecolumn42501; finalrerun pending existingPG PID6800 crashrecovery (57P03), log fsync progressed100seconds/base39362. No code failure observed; no completed rerun claimed. Reapply runtimeprovisioning before activation and require fresh login for prestamp sessions; no hostedactivation. See ACCOUNT_SECURITY_ACCEPTANCE.md. Next implement verified-email recovery and MFA/step-up, accountsecurityhistory; full ERP launch still incomplete.

Local recovery checkpoint21October2026: finalbackend npm.cmd run test:all PASS108/108 exit0,clientbuild46modules PASS,restrictedPGrecoveryHTTP/RLS/delete42501 rerunPASS,014nonbypassupgrade20populatedtables/002-013checksums PASS,Edge12viewports/request/reset/newlogin/usedlink/fragmentremoval PASS and33trackedtablerestore PASS(user/tokenpopulated,businessempty). Runtime startup requires forced globalrecoveryRLS. See ACCOUNT_RECOVERY_ACCEPTANCE.md for exact delivery/timinglimits. Recovery delivery onlyinjectedlocalfixture; defaultdisabled/noactualemail. Retention/operatorcleanup,provideracceptance,timing/load,verifiedemail,MFA/securityhistoryandallremainingERPlaunchgates OPEN. No push/deploy. Next retention/securityhistory andMFA foundations whilepreserving originalfullscope.

Recovery retention21October2026: separate preview-first operator service/CLI,7-365day retention and1-1000batch, application DELETEgrant unchanged. Dedicatedrestrictedoperator provisioning rejects businessprivileges/tokenrewrite/DDL/ownership/memberships; SELECT/DELETE RLS enforces expiredcutoff plus database7dayminimum. RealPG preview4rows ->boundeddelete2+1+0/recenttokenreset, nocontextinvisibility/operatorusers42501/appruntimeDELETE42501, overbroad2099cutoffcannotdeletefreshrow andtokenUPDATE42501 PASS. Initialnewguardtestexpectedoldererrorwording; updated expectedP0001guardandrerunPASS. SQLitefocusedretention1/1/fullbackend109/109 PASS exit0; disabledCLIexpectedexit1 PASS. CLIproductionTLStransport endtoendNOTRUN(localPGfixture usesnonTLSadapter); TLSwasnotweakened. No scheduledcleanup/hostedoperation; onlydisposabletestrowsremoved. Finaldocs/review/checkpoint next; accountsecurityhistory/MFA/provideracceptance/fullERP remainOPEN.

Account security history21October2026:015 globalaccount event ledger forPASSWORD_CHANGED/RECOVERY_RESET only, minimalid/type/timepayload,forcedselfRLS,appendonlyruntimeprivileges/SQLiteguards,privatepagedAPI andaccountsecurityUI. PasswordCAS+event andreset/tokenconsume+event nowatomic. Recoveryauditfailure rollback verifiedSQLiteandactualrestrictedPG; otheraccountempty,selectorquery400,nocontextRLS0,runtimeUPDATE/DELETE42501. Fullbackend110/110/finalfocusedpagination20+2 PASS; clientbuild47modules PASS; actualEdgefreshloginpersistedevent/8viewports PASS/nooverflow/zeroerrors,375pxvisuallyinspected.015nonbypassupgrade21populatedtables/002-014checksums andfresh34trackedtablerestore PASS(security/user/companypopulated,finance/deliveryempty). FirstPGverifierroleprefixexceededallowedlength; shortenedfixtureprefixandrerunPASS. No historicaleventsfabricated; loginfailures/devicehistory/notifications/MFA/liveemail/retentionCLIproductionTLS/fullERPlaunchremainOPEN. See ACCOUNT_SECURITY_HISTORY_ACCEPTANCE.md. No push/deploy/provider/email.

MFA management final checks21October2026: final backend npm.cmd run test:all PASS119/119 exit0 after event-sequence and password-stepup guard changes; finalclientbuild48modules PASS. RestrictedPG management rerunPASS and orderedbrowser16viewports PASS. No MFA checkpoint commit yet:016/017 preservation upgrade,encrypted37tablerestore/separatekeyrestore+rotation,real-authenticator acceptance andfinalreview remain. Liveaccounts/deployment/push unchanged; fullERPobjective active.


MFA preservation and key rotation acceptance: see [MFA_IMPLEMENTATION.md](MFA_IMPLEMENTATION.md). Local PostgreSQL015→016 and016→017 upgrades preserved22/24 populated prior tables and checksums. SQLite37-table encrypted restore, separate fixture keys, HTTP factor proof and active-key rewrap passed. Production/actual-authenticator acceptance remains open.
