# NovaWorks frontend redesign — accepted implementation plan

22 October 2026 · Scope: local candidate only · Planning status: IMPLEMENTABLE

This plan answers the user's current priority: first improve NovaWorks frontend, UI/UX and dashboards toward a professional modern ERP/CRM, retaining the previously approved compact, premium iOS-inspired character. It is a bounded frontend milestone within the unfinished full ERP plan, not a claim that all 65 planned screens or ERP modules exist.

## Authority, baseline and evidence

- Work only in `E:/Projects/Hackathon/tmp/novaworks-next-notifications`, branch `codex/erp-notifications`; inspected HEAD `fe9285f` plus existing uncommitted work. The working tree, not HEAD alone, is the implementation baseline.
- Preserve existing member lifecycle, task, invoice, CRM, and compact-screen changes. Parent integration owner recorded rollback copies under `tmp/frontend-redesign-baseline`; verify their contents before relying on restoration. Do not reset to HEAD or overwrite unrelated edits.
- Original sibling `novaworks-analysis-20261019`, human testing on port 3039, its build/data/private configuration remain untouched. No dependency installation, backend migration, push, deployment, external messages, paid provider calls or trust changes.
- Current candidate `Aizaz/RUN_STATE.md` records POST_HACKATHON_ERP_DEVELOPMENT and approved ERP direction. Candidate lacks the older HACKATHON_CONTEXT/EXECUTION_LOOP/DESIGN_SYSTEM files; parent repository copies were read for history. Candidate `docs/erp/MASTER_PLAN.md` and `docs/erp/DESIGN.md` supply the current post-event product/design direction.
- Fresh source inspection: `App.jsx`, `OrganizationWorkspace.jsx`, `ReportWorkspace.jsx`, `ReportVisuals.jsx`, `erp-shell.css`, module source, report routes/service, API helper and billing policy. Existing tests/evidence in RUN_STATE were read, not rerun during planning.
- Actual tool routing for planning is explicit Astra/high delegation; installed personal agent files exist, but the spawning tool has no custom-role selector. No claim that prose selected a profile.

## Problem, users and useful flow

Owners/admins need a company operating summary and quick access to sales, delivery and collection evidence. Managers need their owned sales and managed delivery. Members need their assigned delivery and approved time. All need company identity, scope, reliable navigation and concise working screens.

Source shows the ten company modules rendered as a horizontal button strip (native select on small screens), a hidden outer ERP sidebar, and delivery as the default landing view. Reports already have authorized, exact snapshots and readable charts. Core workflows already exist; this milestone should expose their useful information coherently instead of introducing new business concepts.

Primary flow: sign in → select an authorized company → view the role-scoped Overview → inspect a real current metric and its scope → open its existing work module → perform an existing permitted action → return/refresh to obtain a new snapshot. No new record is created by opening Overview.

Acceptance example: a member sees only their delivery counts/approved time and links to Projects & tasks, Timesheets, Reports and Settings; no sales or invoice fetch is attempted. An owner sees additional independent sales counts and currency-separated issued-invoice evidence when entitled. Changing company immediately removes all old summaries and remounts the new company view.

## Chosen approach and non-goals

Choose one role-aware Overview and grouped company navigation, reusing React, native HTML, existing request helpers and existing report APIs. This is smaller and safer than separate role dashboards with duplicate fetching, or a UI framework/router/chart-library migration. Shared operating styles polish the existing working surfaces without rewriting financial or authorization handlers.

Must: coherent shell, all existing modules/actions reachable, useful Overview, complete data states, reports refinements, legible consistent working surfaces, exact values, responsive/keyboard design and honest verification.

Should: compact project context, scoped action links and meaningful section headings. Could, only after required checks: tiny local visual adjustments that do not alter data or workflow.

Excluded: new accounting/revenue/profit logic, trends/time-series, growth percentages, conversion funnels, global search, fake activity feeds, artificial notification badges, new API endpoints, new persistent preferences/routes, module placeholders, additional libraries/fonts/assets and expansion into HR/inventory/payroll/POS. Do not add a date-range control when the API only supports a current all-dates snapshot.

## Design system and layout

Continue NovaWorks' system-font and green identity. System family `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`; ink `#182230`, secondary `#526174`, canvas `#F8F9FA`, surface white, border `#DCE3E9`, primary `#174B43`. Reuse existing semantic chart colors with text labels. No font download or visual-effects source.

Use a quiet 224px company rail at desktop, a flexible working canvas and a compact top company/context area. One visible module title and one company selector; remove redundant workspace titles from the visible hierarchy. Keep the existing brand/account/logout header, adapting only company-mode classes where necessary. Original demo/preview navigation and login remain intact.

Navigation order/groups:

| Group | Modules | Visibility |
| --- | --- | --- |
| Workspace | Overview, Projects & tasks, Timesheets | All active company roles |
| Sales | Customers, Pipeline, Quotes | OWNER, ADMIN, MANAGER |
| Finance | Invoices | OWNER, ADMIN |
| Insights | Reports; Meeting AI | Reports all; AI OWNER/ADMIN |
| Company | Subscription; Settings | Subscription OWNER/ADMIN; Settings all |

Overview adds one item; preserve the ten existing module IDs and their handlers. Team directory, invitations and member management remain in Settings. Account security, company creation/join and task notifications remain available through concise labeled disclosures; preserve recipient-scoped notification behavior and manual refresh. Do not invent an unread count before the inbox has loaded.

At <=1024px, company navigation becomes a labeled in-flow collapsible menu with `aria-expanded`/`aria-controls`, not an overlay requiring a modal focus trap. Hide collapsed links from tab order with actual conditional/hidden rendering. Escape closes and returns focus to its trigger; selecting a module closes it and focuses the destination heading. Desktop breakpoint changes clear obsolete mobile state. Controls stay >=44px, small-screen inputs >=16px. At 320px use one column, wrap exact values, contain only genuinely wide tables in labeled keyboard-focusable horizontal regions. Avoid page-level horizontal scrolling.

Typography: main module title 26–28px desktop/22–24px small screen, section 16–18px, body 14px desktop, metadata >=12px; tabular numerals. Use spacing 4/8/12/16/24/32 and white bordered surfaces with restrained 12–16px corners. Cards carry distinct summaries; working records use aligned rows/tables and existing disclosures instead of nested card stacks. Preserve 44px hit targets while tightening unnecessary outer gaps.

Shared styles cover project/task lists, customer/pipeline surfaces, quotes, timesheets, invoice detail, Settings and Billing. Preserve the current compact invoice summary, wrapping saved-items table, task-detail disclosures and member-editor disclosures. Do not hide errors, dirty drafts, read-only explanations or conflict controls for visual density. Existing module-internal headings may remain where they identify a particular record/section.

## Data/API compatibility audit

All paths below use the existing `request` helper, which adds `/api`, includes the session and supports AbortSignal. Selected company remains server-session context; client props are not authorization.

| Source | Contract confirmed in source | Planned use and boundary |
| --- | --- | --- |
| `/v1/organizations`, `/v1/context`, POST `/v1/organizations/select` | Existing company membership/selection flow | Keep shell flow. A successful explicit selection establishes requested company; clear previous view immediately during transition. |
| `/v1/billing/context` | `organizationId`, `enabled`, `access`, `features` | Preserve company binding and read-only banner. `enabled && !features.reports` means do not fetch optional sales/financial summaries. Delivery reporting has no reports-feature gate. |
| GET `/v1/reports/delivery` | All active roles; `projects[]`, `tasks[]` with status/count strings, `approvedTime.minutes`, `billable_minutes` strings | Overview summary and existing DeliveryVisuals. Owner/admin company scope; manager managed projects; member assigned tasks/projects and personal approved time, including historical time after reassignment. |
| GET `/v1/reports/sales` | OWNER/ADMIN/MANAGER, reports entitlement; `deals[]`, `quotes[]`, `orders[]`, count/value strings | Separate deal/current-quote/order counts, each linking to existing Pipeline/Quotes. Manager sales are owned, not all company sales. No combining monetary values across stages/currencies; quotes exclude superseded versions. |
| GET `/v1/reports/financial` | OWNER/ADMIN, reports entitlement; `currencies[]` with issued/credited/paid/outstanding/overdue minor-unit strings | Per-currency outstanding and overdue outstanding, with optional issued/net-payment detail and link to Invoices. Draft invoices excluded, credits/reversals respected. Label as invoice/payment evidence, never revenue, cash balance or profit. |
| All three reports | `kind`, `organizationId`, `scope`, `generatedAt`, `filters`; current snapshot, no date-range support | Verify expected company and kind before accepting results. Display each section's own UTC timestamp; parallel requests are not one atomic cross-report snapshot. |
| Existing projects prop | Authorized current company's project list from `/v1/projects` | Optional concise project context only. It is not a source of company-wide totals or overdue task metrics. Prefer delivery report counts for dashboard summaries. |
| POST `/v1/reports/:kind/export` | Audited fresh report returned with company/scope/time | Preserve exact JSON export. Displayed report updates to match successful export; guard late/foreign response before download. |

Overview composition: compact title/scope/refresh; delivery summary (projects, open tasks as TODO + IN_PROGRESS, approved hours/minutes), labeled delivery status visualization; role-permitted sales counts; owner/admin invoice evidence separated by currency; a short permitted action area opening existing modules. It is acceptable to omit duplicated decorative charts when the actual metric is already clear. Zero records is an explanatory empty state with a relevant navigation action, not a fake sample.

Counts, money and minutes stay decimal strings/BigInt through aggregation/formatting. Do not use `Number(amount_minor)`, parseFloat or floating-point currency addition. Only bounded chart ratios may convert to Number after integer scaling, following existing visuals. `DONE / total` is a status distribution, not measured work completion. Due/overdue means only the exact financial API definition: positive issued-invoice balance with due date before current UTC day.

## State, safety and component contract

New default is `overview` on initial company entry and every successful company switch. No company selected means onboarding/company tools, not an empty dashboard. Local module state remains intentionally nonpersistent; this milestone does not promise browser Back/deep links. Preserve existing quoteSeed/invoiceSeed transitions for Pipeline → Quotes → Invoices.

Shell retains sole ownership of organizations, selected company, companyBilling, role-derived module list, workspaceView, seeds, members/projects and company mutations. `chooseModule` must validate against current permitted IDs before navigation; never trust a dashboard-supplied target. Render guards remain in place even if a formerly visible role item disappears. Safe fallback is Overview. Existing API authorization remains authoritative.

Overview worker delivers:

```jsx
<OverviewWorkspace
  key={selected}
  organization={organization}
  billing={companyBilling}
  onNavigate={chooseModule}
  onExpired={onExpired}
/>
```

No user prop or project fetching is required. Component exports default from `OverviewWorkspace.jsx`. Navigation uses existing string IDs only: delivery, time, pipeline, quotes, invoices, reports, settings, billing. The shell validates these. Actions are navigation, not hidden mutations; do not create/issue/pay directly from the dashboard.

Fetching rules:

1. Unmount the prior company content as soon as company selection begins; do not show the old company under a newly selected label. Preserve company bootstrap/select recovery and error notices. Disable additional selection while its existing request is pending.
2. Use AbortController plus a request generation/current-company guard in every new async path. Aborting alone does not prevent already-resolved promises from setting state. On cleanup invalidate generation, then abort. Guard successful results, errors and finally handlers.
3. In OrganizationWorkspace, add these guards to the touched company bootstrap effect, checking every returned project/membership organization's identifier where available and the billing response organizationId. On mismatch discard the whole bootstrap result and require reload/reselect. Do not display a mixture of tenants. No new mutation payload fields.
4. Overview resets all snapshots/errors at start of refresh, company or role change. Fetch delivery always; sales only authorized manager/admin with entitlement; finance only authorized admin with entitlement. Avoid N+1 queries, polling, global cache and cross-company memoized snapshots.
5. Keep independent section loading/error states. Delivery failure is visible; optional sales/finance failure does not erase a successful delivery section. A failure or missing data never becomes numeric zero. Retry performs a fresh read. Role and entitlement branches are recalculated on render and effect dependencies include company ID, role and relevant billing eligibility.
6. A report `organizationId`/kind mismatch discards that response and shows company-context recovery. HTTP 401 invokes onExpired. HTTP 403 clears the affected report and shows access changed/unavailable; do not retry under a guessed role. 402 shows report entitlement unavailable. The module's own action APIs continue enforcing current session membership. There is no promise of instantaneous push-based revocation: refresh/navigation obtains current authority.
7. Re-entering Overview remounts/fetches a new snapshot after module work; expose manual Refresh. Reports also include company ID/role in effect dependencies, guard stale responses and export completion, and reset a formerly selected inaccessible report kind to delivery.
8. Account-level security remains available without a selected company. Keep member administration's existing read-only exception; do not blanket-disable every company control simply because billing is read-only. Overview navigation remains usable; existing modules decide permitted mutations.

No shared cache/context provider, routing library or backend endpoint is needed. Existing feature-specific conflict/version/idempotency behavior remains owned by its existing component and service.

## Two bounded workers and integration order

Use the engineering workflow's explicit bounded delegation. Implementation uses Luna/high, escalating to Sol only for observed complexity/failure; independent verification uses Sol/high. One writer per file.

| Owner | Owned files | Deliverable and checks |
| --- | --- | --- |
| Worker A — shell/working surfaces | `app/client/src/App.jsx`, `OrganizationWorkspace.jsx`, `erp-shell.css` only | Grouped responsive company navigation, Overview integration, default landing, company-binding guards, focused scoped styling for existing working modules. Preserve demo and all handlers. Do not edit worker B files. Build after B's interface exists; report missing dependency honestly before then. |
| Worker B — overview/reports | New `OverviewWorkspace.jsx`, `overviewModel.js`, `overviewModel.test.js`, `erp-insights.css`; existing `ReportWorkspace.jsx`, `ReportVisuals.jsx` only | Real role/entitlement-aware Overview, exact derived display helpers, async safety, report presentation and scoped CSS. Import new CSS from own components and use `.erp-shell .overview-workspace`/`.erp-shell .report-workspace` selectors to avoid main CSS-order dependency. Do not edit main.jsx, styles.css or shell files. |
| Integrator | State/docs after workers finish; integration corrections only after taking ownership | Confirm interface; integrate both results; update DESIGN/RUN_STATE and acceptance evidence; run build and affected checks once. Own no concurrent worker file. |
| Independent verifier | New verification evidence/script files as agreed; no product edits while workers run | Review source, exercise exact projections/API regression and permissible static DOM assertions. Return defects with files/evidence. Rendered browser acceptance remains blocked. |

Both workers receive this file, current state, their owned files and protected baseline. They may inspect other source. Neither changes backend, dependencies, original human checkout, protected runtime data or other worker files. Return changed files, exact commands/results, known gaps, next action. Avoid global replacements over minified one-line JSX; preserve semantic mutation handlers.

Stage 1: workers implement independently against fixed Overview props. Stage 2: integrate/build, check source contracts and tested projections. Stage 3: independent verification; repair concrete findings, rerun only affected checks. Stage 4: save evidence and provide a local frontend milestone with visual acceptance explicitly BLOCKED; do not declare complete design acceptance.

## Requirements mapped to acceptance

| Requirement | Acceptance evidence |
| --- | --- |
| Professional coherent navigation | Source/static DOM: one active company-module action, grouped items, correct owner/manager/member visibility, all original IDs reachable; browser keyboard/reflow pending. |
| Useful actual dashboard | Exact helper fixtures from real report schema; API report tests confirm scopes and finance calculations; no preview/sample imports or hardcoded metrics; navigation actions lead to existing modules. |
| Company/security boundaries | Async source review for abort/generation and organization matching, no unauthorized report requests by role, context mismatches rejected; existing membership HTTP tests pass. |
| Exact finance/time | Values beyond Number.MAX_SAFE_INTEGER preserved, separate USD/GBP/PKR, zero vs unavailable distinct; existing report invoice/reversal/credit/approved-time tests pass. |
| Existing module behavior | No backend/mutation-contract changes; seeds, Settings team, security, notifications, disclosures, export and permission/read-only/conflict paths remain present; affected backend tests pass. Runtime UI action checks pending. |
| Reports polished and safe | Existing filters/export/SVG descriptions/exact value tables preserved; company and role changes clear inaccessible report; per-report timestamp, scope and truthful labels remain. |
| Shared working surfaces | Scoped control/spacing/type styles, compact invoice and task/member disclosure structures preserved; no global demo CSS regression by source inspection. Visual result pending. |
| Accessibility/responsive | Semantic landmarks/headings/labels/buttons; current/expanded states, hidden collapsed menu, focus logic, reduced motion and contained tables checked in source/static DOM; actual keyboard/contrast/zoom/render pending. |

## Verification and present blocker

Run from candidate root with existing installed tools only:

- `npm.cmd run build --prefix app/client`
- `node --test app/client/src/overviewModel.test.js app/client/src/pipelineMoney.test.js`
- `node --test backend/test/reports.test.js backend/test/invoicing.test.js backend/test/time-billing.test.js backend/test/member-lifecycle.test.js`
- `git diff --check` and focused diff review against pre-task file copies, not only HEAD.
- If an existing trusted mechanism permits nonbrowser React static rendering, assert heading/nav/roles/empty values and accessible markup. Clearly label it static DOM: it does not execute effects, prove network orchestration, CSS layout or keyboard interaction. No new dependency needed just to obtain this evidence.

Helper tests must cover meaningful behavior: exact very large sums, empty vs unavailable data, permitted report kinds per role/entitlement, all three currency groups and approved-time minute formatting. Tests must not simply mirror markup strings. Existing source report tests exercise real service/database behavior; test runner success is not new browser evidence. Run fresh disposable data only if new API verification is required; never repurpose the human fixture or run a persistent verification launcher blindly.

Current browser URL policy explicitly rejected acquisition of `http://127.0.0.1:3048`. Do not navigate again through another port, hostname, browser, screenshot/automation tool or proxy as a bypass. Do not change trust/security settings. Browser inspection through a different surface is not authorized by this plan. The earlier report/compact screenshots predate this redesign.

After that policy boundary is resolved through approved means, the remaining acceptance matrix is real browser at 320/390/768/1024/1440px, owner/manager/member, two companies and switching during pending reads, zero data, huge values, reports entitlement off, read-only billing, 401/403/network failure, keyboard menu/disclosure/focus, 200% zoom and reduced motion. Exercise task disclosure, Settings team editor, invoice PDF/payment/correction, timesheet log/review, quote/order/invoice transition and report export without affecting protected human data. Capture actual screens/console/overflow and observed actions. Until then, visual/interaction acceptance is BLOCKED, not passed or implicitly covered by build/API checks.

## Risks, rollback and review conclusion

- Stale company summaries: mitigate explicit unmount/reset, generation guards and response organization validation. Server authorization remains source of truth.
- Stale role visibility: hide according to latest role props, guard target navigation, clear on access failure; no promise of a realtime membership subscription.
- CSS leakage and existing compact regressions: scope to company classes, preserve demo branch and existing module DOM; review file baseline and await actual rendering acceptance.
- Misleading analytics: current/all-dates labels, independent section timestamps, currency separation and exact BigInt handling. No revenue/profit/trends inferred.
- Existing uncommitted lifecycle work: this frontend milestone does not certify its outstanding PostgreSQL/browser acceptance. Preserve its implementation and report limits separately.
- Two-worker overlap: fixed files/props above. Shared-file corrections become sequential after ownership handoff.

Rollback is local and file-scoped: restore only this milestone's frontend edits from the verified pre-task copies, retaining unrelated/preexisting changes; remove only the newly created dashboard files after confirming exact paths are within this checkout. Keep all existing backend, data, build and sibling human files. No destructive git reset/clean.

Architect review resolved API availability, role/entitlement scope, default landing, worker interface, company cancellation, currency arithmetic, mobile navigation behavior and rollback. There is no unresolved critical implementation assumption requiring another design loop or user permission. The material unresolved acceptance dependency is approved browser access; proceed with authorized local implementation and source/API verification while reporting that boundary explicitly.
