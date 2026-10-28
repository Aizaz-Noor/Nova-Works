# NovaWorks ERP — midterm project analysis

**Date:** 28 October 2026 · **Live application:** https://nova-works-zeta.vercel.app

This report describes the current application, its working flow, evidence and remaining limits. The current version was deployed before preparing this analysis. It is a service-business ERP demonstration with substantial working modules; the full commercial ERP roadmap is unfinished. No completion percentage is assigned.

## 1. What the project does

NovaWorks connects customer relationships, sales agreements, project delivery, recorded effort and client invoices in one company workspace. Its main purpose is to reduce disconnected records: a team should be able to trace an invoice back to agreed work and understand which tasks and time entries belong to that engagement.

The project began as a meeting-to-project hackathon application and later expanded into an ERP. The original project/task/team screens remain alongside the company workspace. The broader scope does not mean inventory, payroll or full accounting have been implemented.

## 2. Architecture and permissions

| Layer | Actual implementation | Why it matters |
| --- | --- | --- |
| Interface | React 19, Vite 6, JavaScript and shared CSS/components | Responsive forms, module navigation, saved views and role-dependent controls. |
| Server | Node.js 24 and Express 5; modular monolith | CRM, sales, delivery, time and finance services share controlled transactions without becoming separate deployed microservices. |
| Hosted data | PostgreSQL on Supabase; restricted application database role | Company-scoped records, foreign keys, transactions and forced row-level security protect data beyond hidden UI buttons. |
| Local demonstration | SQLite, isolated fictional records | Supports development and repeatable local demonstrations; SQLite success alone does not prove PostgreSQL isolation. |
| Hosting/documents | Vercel frontend/API; PDFKit invoice generation | Current application is public; PDF download requires authenticated invoice access. |
| Identity | Passwords, server sessions, trusted-origin checks, company context, MFA/security modules | A signed-in identity and current company membership authorize each protected request. |

**Owner/Admin:** permitted company administration and finance. Some actions, including subscription binding, have stricter owner-only rules. **Manager:** permitted sales records, assigned delivery work and eligible time review; company finance is restricted. **Member:** permitted assignments, own task updates and time submission. Company roles differ from the original legacy Administrator/Manager/Developer roles.

Selecting a company sets session context. Requests also carry the expected company header. A stale or wrong context is rejected rather than silently applying an edit to another company. Version checks reject stale project/task updates. The new deployment supports these revisions; old immutable deployment URLs remain a limitation because older writers do not increment them.

## 3. The complete business workflow

1. **Sign in and select a company.** The user opens the correct workspace. Starting demo records are fictional saved examples, not actions the evaluator has just performed.
2. **Capture the customer opportunity.** Create a lead, qualify it and convert it into linked customer/contact/deal records. An existing customer can also start a deal. Contacts and activities preserve relationship history.
3. **Agree scope and price.** Prepare a quote with customer, currency, items, quantities, prices and terms. Issue it, record acceptance with a reference, then convert it to a sales order. Issued terms and order snapshots preserve the agreement. Recorded acceptance is internal evidence, not a customer portal or electronic-signature service.
4. **Create delivery work.** Mark the deal Won and create its linked project with manager/deadline. Add assigned tasks and estimated hours. Tasks move `TODO → IN_PROGRESS → DONE`; project status is separate. Comments and milestones support coordination. A project deadline cannot contradict existing task deadlines.
5. **Record and review time.** A worker creates a dated entry and submits it. Another eligible reviewer approves or rejects it. Self-approval is prohibited. Rejected entries can be corrected and resubmitted; approved history is protected. For a fixed-price engagement, nonbillable time documents effort without adding another client charge.
6. **Create an ORDER invoice.** Owner/Admin selects the accepted sales order, reviews the draft and issues a numbered invoice. Issued data becomes a preserved snapshot. The authenticated PDF should agree with its online details.
7. **Record a received payment.** Enter amount, date and receipt/reference after an external payment. The app records evidence and calculates outstanding balance; it does not charge a card or transfer money. Overpayments and inconsistent currency are rejected. Corrections use retained reversal/credit history rather than silently deleting issued evidence.
8. **Reconcile and reopen.** Reports summarize permitted sales, delivery and finance records. Reopen the same records after refresh/sign-in. A Won deal, Done task, approved time and Issued invoice are different states; none alone proves collection.

### The separate TIME invoice branch

For different work billed by effort, configure a customer/project hourly rate, submit **billable** time and obtain independent approval. Owner/Admin selects eligible approved entries, previews charges, creates a TIME draft and issues it.

Calculation uses integer minutes and integer minor currency units, with half-up rounding per entry. Example: 90 minutes at PKR100.01/hour produces PKR150.02. The invoice preserves minutes, approval and original rate/version. A later rate change does not rewrite it. Allocation prevents the same entry being billed twice through TIME invoices; credits/replacements retain that allocation. Partial allocation and billed-time adjustments remain outside the current implementation. There is no claimed universal policy preventing someone charging the same engagement through unrelated ORDER and TIME sources; choose the correct source deliberately.

## 4. Screen and module status chart

**Evidence labels:** **H** = current staged hosted HTTP/data checks; **L** = retained local browser/service/database evidence; **S** = current source inventory. H does not prove rendering or every mutation. Fresh public browser observations are recorded separately below.

| Actual screen or area | What has been made | Evidence and practical limit |
| --- | --- | --- |
| Home / Sign in | ERP introduction, labelled login, optional motion and MFA challenge | H assets/cookie/login; L responsive, keyboard, reduced-motion/fallback and human zoom. The illustration is not transaction evidence. |
| Create account / Recovery | Registration and conditional recovery request/reset screens | S/L. Live recovery delivery is not configured; hosted signup/reset was not exercised for this release. |
| Company picker / Company tools | Company creation/selection, joining invitations and account utilities | H selection/context; L isolation and stale-context recovery. Invitation creation does not send email. |
| Overview | Role-scoped attention, delivery/sales/finance summaries and module shortcuts | S/L. It summarizes saved records; it does not replace their authoritative details. |
| Customers | Search, customer details, contacts, activities and project links | H seeded customer read; L create/edit/conversion/link continuity. Imports/merge/erasure are roadmap work. |
| Pipeline | Leads/deals, qualification/conversion, stage/ownership/follow-up, Won-to-project handoff | H deal read; L full conversion and delivery linkage. Broader reminders remain open. |
| Quotes / Sales orders | Drafts, issued versions, acceptance/revision history and immutable order conversion | H quote/order reads; L actual issue/accept/convert. No external customer approval portal. |
| Projects & tasks | Project list/detail/status/deadline; task creation, assignment/edit/status; filters/saved views | H current reads/positive revisions and manager scope; L member workflow, deadline/conflict tests. Full boards/templates/project lifecycle are unfinished. |
| Project milestones | Dated checkpoints with Open/Done/Cancelled states and version checks | S/L, including local access/retry/conflict evidence; not freshly exercised hosted. |
| Task comments | Permitted task thread, author/timestamps, paging, retry protection and limits | S/L. Broader event/moderation/retention work remains. |
| Task attachments | Private list/upload/download with size/type/hash/access checks | S/L with real local bytes/recovery. Durable hosted storage adapter is unconfigured; do not present hosted file transfer as operational. |
| Notifications | Company/user inbox, unread state and mark-read action | H list endpoint; L comment notification persistence. This is in-app notification, not email delivery. |
| Timesheets | Own drafts/submission, team review, rejection/resubmission and protected decisions | H entries; L real worker submission and independent approval. Hosted new approval was not exercised by the read-only acceptance. |
| Hourly billing rates | Versioned customer/project rates under Timesheets | H rate-list endpoint; L rate edit, exact charges and snapshot preservation. Saving a rate does not invoice time. |
| Invoices / Approved-time composer | ORDER/TIME sources, draft/issue, payment evidence, reversals, full unpaid credit/replacement and PDF | H existing invoice/PDF/ledger checks; L both complete branches. Basic Latin PDF font; partial credits/refunds and bank integration unfinished. |
| Reports | Sales, delivery and financial summaries; currency separation and audited JSON export | H three report reads/reconciliation and manager finance denial; L rendered/export evidence. Not a general ledger or historical analytics suite. |
| Meeting AI | Meeting queue, processing/review, corrections, approval/discard/content controls | S/L fixture/service evidence. Actual live AI execution is NOT VERIFIED; no paid call was made for this release. Persistent hosted worker operation is unconfigured. |
| Subscription | Company SaaS access, entitlements, trial/grace/read-only foundations and provider reconciliation controls | S/L simulated provider evidence. Billing is disabled in the demo; no live checkout, charge or merchant acceptance claim. Separate from client invoices. |
| Settings / People | Company legal name, default currency/locale/timezone, invitations and membership status/roles | H settings read; L saved settings/membership controls. Defaults affect new records; issued snapshots stay fixed. Broader ownership/lifecycle administration remains open. |
| Account security | Password change, MFA management/recovery codes and private security history | S/L; H session behavior. Real authenticator/production key operations are not newly verified. Shared demonstration credentials are not private business accounts. |
| Legacy meeting workspace | Original projects/detail, assigned tasks, team directory and transcript draft review | S and retained original evidence. Preserved history, distinct from company ERP. Preview mode contains static samples and must not be called live processing. |

## 5. What the evidence establishes today

The release owner confirms the public alias was promoted to `dpl_23Hc6wiNw9fasaMRbuBFWmxBkiRi`, using the reviewed 189-file source bundle. Before the hosted change, a native encrypted snapshot was reopened and restored into a fresh local database: all 55 schema table counts/digests matched, with owner/ACL/RLS/policy/function checks. Migration025 was rehearsed, then applied transactionally on hosted data, preserving old rows/security and existing runtime credentials. These are release-owner execution results, not actions replayed by this report author.

**PASS:** candidate acceptance contains 59 HTTP checks and zero failures: matching built assets, authentication/cookie flags, company context, existing business records, invoice PDF signature, financial reconciliation, unauthorized company selection/logout and manager finance denial. Candidate requests used authenticated CLI transport with the public Origin; this is explicitly not browser-origin evidence.

**PASS, retained local scope:** 165 backend regression tests; browser-created ORDER and separate TIME workflows, independent time approval, exact amounts, persistence/restart, selected responsive/keyboard/conflict cases. These were not all rerun against the public deployment.

**PASS, current public deployment:** Vercel's alias lookup confirms `https://nova-works-zeta.vercel.app` points to `dpl_23Hc6wiNw9fasaMRbuBFWmxBkiRi`. The release's public native-HTTPS verifier passed all 59 checks with zero failures. In a real browser on 28 October, the owner sign-in/session and company selection opened the live `NovaWorks Demo Workspace`. Overview showed one project, one open/in-progress task, 90 approved minutes, one deal, one quote, one order and one issued invoice. Customers showed one fictional Northstar prospect. Pipeline opens on Leads by default, where this seeded company has zero lead records; switching to Deals showed one `Customer intake portal` opportunity at Won with PKR85,000 potential value. Direct invoice details showed `INV-000001`, PKR85,000 total, PKR15,000 active payment and PKR70,000 unpaid; the task detail showed the expected project, manager, deadline and hours. A live task-status save was confirmed and then restored to its original In progress state. No customer payment, email, provider call or company access change was performed.

The user separately confirmed that Home/login controls remain readable and reachable at real 200% browser zoom; prior human zoom checks for the redesigned dashboard and record pages are also recorded. Root's current browser observation used a narrow in-app panel, not a desktop-width browser, so it does not add a new full-width visual or module-by-module browser acceptance claim. The task status test leaves ordinary audit history of the temporary Done change and restoration, while the current task value is back to In progress.

Current live captures: [overview](../assets/live-evaluation-20261028/overview.png), [Won deal list](../assets/live-evaluation-20261028/pipeline-deals.png) and [invoice details](../assets/live-evaluation-20261028/invoice-details.png). The Overview attention card has one reproduced display-only issue: it renders the currency prefix twice (`PKR PKR 70,000.00`); the detailed invoice and finance summary show the correct PKR70,000 amount. No functional defect was reproduced in the checked live flows.

The edited local tutorial is [the workflow guide video](../assets/novaworks-workflow-guide-20261028.mp4), 216.96 seconds, silent with captions. It uses different fictional QA data: PKR100 invoice, PKR25 receipt and PKR75 balance, plus 90 nonbillable approved minutes. It is actual-screen footage with edits/reading pauses, not an uninterrupted recording or fresh hosted demonstration. [Tutorial notes](../WORKFLOW_TUTORIAL.md) describe its limits.

## 6. Broken, unconfigured, unverified and unfinished

| Category | Honest assessment |
| --- | --- |
| **BROKEN / FAIL** | One current cosmetic defect was reproduced on live Overview: the outstanding-balance attention card repeats `PKR` before the amount. Other tested invoice and summary amounts reconcile. No functional failure was reproduced in the live login, company selection, customer-list, project/task or invoice-detail flow. This does not certify every screen. Earlier harness failures were corrected; they are not current product failures. |
| **IMPLEMENTED, UNCONFIGURED** | Durable hosted attachments, recovery-email delivery, persistent background workers and live subscription purchase/provider setup. The demo cannot honestly promise these operations. |
| **NOT VERIFIED** | Live AI/provider response; all hosted write workflows; every module's fresh public rendering; broader PDF scripts/layout; load/security certification; cross-machine backup-key recovery. Local hidden-document media behavior and exact late-response/context edge cases remain finite evidence gaps. |
| **ROADMAP, NOT BUILT** | Full inventory, HR, purchasing, payroll, accounting and POS; wider project lifecycle/templates, customer portal, imports, partial time allocation/financial adjustments and advanced analytics. These are different from broken existing controls. |

The existing paid-rollout, legal/tax, monitoring, support and real-customer validation gates remain open. This release is an evaluation/demo release.

## 7. A 5–7 minute evaluation demonstration

1. **0:00–0:45:** Open the public address, sign in as the fictional owner and select **NovaWorks Demo Workspace**. Explain the company boundary and seeded starting data.
2. **0:45–1:30:** Customers → Pipeline. Show the linked customer, Won deal and delivery project; explain the lead conversion path.
3. **1:30–2:15:** Quotes → Sales orders. Explain agreed scope, acceptance reference and preserved price.
4. **2:15–3:15:** Projects & tasks → Timesheets. Show assignee/deadline/status and the existing independently approved 90-minute record. Do not say you just created or approved it.
5. **3:15–4:30:** Invoices. Show source, lines, actual receipt/balance and PDF. Explain the separate TIME branch and that no money moves.
6. **4:30–5:30:** Reports. Reconcile the displayed currency totals. Switch to the fictional manager if time permits and show permitted work/finance restriction.
7. **5:30–6:30:** Settings/security overview, limitations and sign out. Use the local edited tutorial as backup media; identify it as local evidence.

Use the public fictional Owner or Manager account from the sign-in screen. The public demo uses shared sample records; avoid creating records, changing membership/security or enabling providers during an unprepared evaluation.

## 8. Likely viva questions

- **Why call it ERP?** It integrates sales, delivery, time and finance in shared company records; full multi-industry ERP expansion remains future work.
- **How is company data protected?** Server membership/role checks, expected company context and PostgreSQL forced row-level security, with a restricted runtime role.
- **What prevents lost edits?** Version-based updates reject stale revisions; old deployment writers remain a disclosed boundary.
- **Why must another person approve time?** It separates recording work from authorizing billable effort and preserves the decision history.
- **ORDER versus TIME?** ORDER bills agreed sales terms; TIME bills selected approved effort with preserved rate/minute snapshots.
- **Does payment mean a bank transaction?** No. It records evidence of an external receipt and updates the internal balance.
- **Where is AI used?** Optional meeting intake proposes projects/tasks for human review. Live provider execution has not been verified here.
- **What is the next priority?** Validate remaining hosted interactions and configure necessary operational integrations before any commercial pilot, while preserving the working core.

**Source trail:** current `App.jsx`, `OrganizationWorkspace.jsx`, mounted platform/module routes; [module coverage](../../.engineering/MODULE_COVERAGE.md), [local audit](../../.engineering/CLOSURE_AUDIT_20261028.md), [workflow guide](USER_WORKFLOW.md), [TIME acceptance](TIME_INVOICES_ACCEPTANCE.md), [roadmap coverage](PLAN_PROGRESS.md), and the release owner's current deployment/backup/HTTP evidence. Older dated documents may describe superseded blockers; evidence dates and environments matter.
