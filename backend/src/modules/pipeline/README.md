# Pipeline integration

The pipeline is an operational CRM workflow, not revenue recognition or accounting.
Amounts are integer minor-unit strings; USD, GBP and PKR currently use two decimal
places. APIs never accept decimal monetary numbers or floating-point amounts.

Migration 005 adds company-scoped stages, leads, deals and won-deal project links.
Migration credentials must own the original organization table or have explicit
administrative authority to alter its RLS flags. During the migration transaction,
organization FORCE RLS is temporarily removed so its migration owner can discover
existing organizations for stage backfill. FORCE is restored before completion;
rollback restores the prior setting on any failure. The application role never
receives ALTER or ownership permission. Fresh organizations seed their stages in
the same transaction as creation, rather than mutating data during GET requests.

OWNER/ADMIN/MANAGER can read pipeline data. Managers edit only their own leads and
deals. Customer operations additionally require ownership of the related customer
for managers. Conversion locks the lead, validates qualification, and creates or
selects a customer, deduplicates a nonempty matching contact email, creates one NEW
deal, and marks the lead converted atomically. Repeats verify current permissions
and return existing records; an explicit different customer returns 409.

WON/LOST are terminal deal states. LOST requires a reason. Won-deal project creation
locks the deal and creates its project, customer relationship and deal relationship
together. Same-option retries return the original project, while changed explicit
creation options return 409. All successful business mutations include audit rows;
replays create no audit duplicates. Optimistic versions protect edits, and unique
company/source-lead and company/deal links protect against concurrent duplicates.

Stages and deal/project link tables expose SELECT/INSERT privileges to the runtime
role. Leads/deals support SELECT/INSERT/UPDATE; no DELETE policy or API exists.
