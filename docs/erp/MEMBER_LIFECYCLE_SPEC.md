# Company member lifecycle — verified prerequisites and next contract

22October2026. Current membership suspension/role editor is NOT implemented. This document records inspected integration requirements; it does not claim a new permission model is accepted.

## Verified permission hardening

Current application services INSERT memberships for company creation/invitation acceptance and SELECT them for scope. No backend/src membership UPDATE/DELETE path exists. Old generic runtime provisioning nevertheless granted these privileges. Provisioning now gives membership SELECT/INSERT only; startup checks deny any membership column UPDATE or table DELETE privilege. This blocks direct modification/deletion of existing membership rows using the normal runtime credential. It does not redesign INSERT/bootstrap RLS or claim protection against every possible arbitrary-SQL attack.

Actual `node --test backend/test/runtime-startup.test.js backend/test/runtime-role.test.js backend/test/tenant-foundation.test.js`: PASSexit0,9/9,2135.8645ms. Actual `node scripts/verify-membership-grants-postgres.mjs`: PASSexit0, fresh restricted runtime registration/company/invitation/acceptance/project reads; raw selfpromotionUPDATE42501/deletion42501, originalrolepreserved, foreigncompany403/no-context0rows; accidental UPDATE(role) grant causes startup rejection; rerun provisioning removes it. Evidence tmp/membership-grants-pg-giFIJ9/results.json. Existing deployed runtime roles need authorized reprovisioning before accepting the new startup invariant; no hosted role was changed.

## Required transition slice

Preserve memberships and authorship references. Add ACTIVE/SUSPENDED state and version in a forward migration; backfill all existing memberships ACTIVE. Do not DELETE memberships, approvals, comments, files or invoice actors. Suspension affects only one company; global account/session and other-company access remain available. Every new company request must resolve current state, not rely on cached session role. In-flight requests need an explicit linearization rule: shared membership locks for permitted writes and exclusive transition locks can make suspension wait for earlier writes, with subsequent requests denied. Do not claim retroactive cancellation of completed work.

Initial role controls: OWNER can manage ADMIN/MANAGER/MEMBER; ADMIN can manage only MANAGER/MEMBER, never another admin/owner. No self role change, self suspension, owner suspension/demotion or ownership transfer in this first slice. Owner transfer and last-owner handling require a separately guarded flow. Current version required; stale409 preserves proposed UI edits. Atomic audit with state/role transition; repeat same state is explicit and predictable. Reactivation should not silently rewrite old assignments or document authorship.

Application integration proven necessary by source inspection:
- platform/service transaction validates membership before setting company context; add current active-state gate there and filter listOrganizations/context selection. Preserve bootstrap register/createOrganization/acceptInvitation behavior.
- acceptInvitation already rejects any existing membership (ALREADY_MEMBER); do not use a new invite to bypass suspension or silently reactivate it.
- manager/task assignment validation and company-AI directory currently query memberships by role only; exclude suspended people from new assignments/AI proposals while retaining historical names.
- companyAi worker says it uses creator membership checks; verify claim/process/finalize after suspension and never approve automatically. Leased/in-flight work needs explicit fencing behavior.
- billing seat counts currently count all memberships in policy/service/operations. Keep this policy unchanged until active-seat/reactivation quota behavior is specified and tested; do not silently change commercial entitlements.
- security revocation must remain possible under business read-only billing; design a narrowly authorized maintenance path rather than bypassing all subscription enforcement.

## Database proof gate before lifecycle implementation

Historical PostgreSQL policies often scope only organization_id and rely on application membership validation. Adding status only in the UI/service would not prove suspended raw-context database denial. A forward policy design must prevent suspended user reads/writes across every tenant table, preserve no-context denial and legitimate own-membership discovery/bootstrap, avoid recursive policies on memberships, and account for background jobs. A narrow active-access ledger or hardened membership-check function are candidates, not selected/verified implementations. Prototype the policy with a nonowner NOBYPASS runtime before migrating the full schema; inventory every existing table and exception explicitly. Do not weaken FORCE RLS or grant generic membership UPDATE to ship the editor.

Acceptance: two companies/one shared user; existing authenticated sessions; suspend inA then allAprojects/comments/attachments/AI/reports/exports reject whileBworks. Raw restrictedPGcontext likewise blocked. Reactivation restores only authorized scope; old invoice/approval/comment/file history retains authorship. Concurrentrole/state edits one succeeds/one409; self/admin escalation/owner transitions denied; audit failure rolls back; unauthorized/expired sessions denied. Verify oldschema populatedupgrade/checksums/recovery, actualbrowserroleeditor and no read-onlybilling revocation deadlock. Project membership/granular permissions remain a subsequent required scope, not completed by this slice.

## Parallel execution limit

The two requested review agents failed before performing their review because the account usage limit was reached. Primary agent performed the source inventory and permission hardening directly. No independent specialist architecture review is claimed for this document. Existing full ERP objective remains active.

## Database-policy prototype — 22 October2026

Actual `node scripts/verify-member-access-policy-prototype.mjs`: PASSexit0. Latest evidence tmp/member-gate-prototype-RpecRO/results.json. Fresh disposable database only; no application migration or human-test state changed.

The prototype adds status plus a separate member-access gate. A NOSUPERUSER/NOINHERIT/NOBYPASSRLS owner maintains this gate through a hardened SECURITY DEFINER membership trigger. FORCE RLS remains on the gate; trigger-only same-company write policies use actual pg_trigger_depth(), and normal runtime has SELECT only. Own-gate reads avoid a memberships→memberships policy cycle. Restrictive active-gate policies cover41 current tenant tables, with explicit own-membership discovery, company bootstrap and token-scoped invitation exceptions.

Verified: ordinary service register/create-company/active-project reads succeed; proposed invitation bootstrap cannot read its invitation without transaction-local matching token hash, then accepts using matching hash and account email. After an administrative fixture transition, suspended user sees no company projects, task INSERT gets42501, membership/gate discovery exposes only own row; another company and active owner continue to work; reactivation restores project reads. This is a policy mechanism proof, not every table's full workflow or application suspension acceptance.

First attempt failed because fixture administrative UPDATE omitted transaction-local company context; the nonbypass trigger correctly refused the gate write. Fixed fixture sets company/actor on one explicit transaction; subsequent runs passed without relaxing policies. A later negative token-context assertion also passed.

Selected next implementation direction: forward024 ACTIVE/SUSPENDED+version and access-gate backfill/trigger/restrictive-policy inventory, application active-state checks and token-hash bootstrap context, controlled owner/admin transition function (runtime still no generic membership UPDATE), then editor and full role/session/worker/recovery tests. Shared actor locks must not deadlock with existing billing company locks: use a dedicated authorized security-maintenance transaction path with a documented ordering rule. Initial owner/self transitions remain forbidden. The prototype does not implement this function, API, editor, worker fencing, assignment exclusion or project membership.
