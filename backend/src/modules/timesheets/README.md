# Timesheets module

Own dated time -> draft -> submission -> independent project-manager/admin review -> protected approved minutes. Billable is a classification, not a calculated price or invoice. Billing rates, invoice linkage, payroll and correction/reversal of approved time are deliberately deferred.

Duration is integer minutes,1-1440 per entry; non-discarded time cannot exceed1440 per worker/date. PostgreSQL cap-affecting mutations serialize on the worker's company membership row, so separate application instances share the same limit. SQLite uses the existing transaction queue. Creation uses a worker/company request key and canonical original-input hash: retries do not double-record time or audit, while changed payloads under an already-saved key conflict.

Workers may log only on managed projects or their own assigned tasks; members must select an assigned task. Current permissions are rechecked on edits/submission. Own historical records remain readable after reassignment, and mistaken draft/rejected records can be discarded (retained as VOID). Drafts/VOID are private; management team views show submitted/reviewed time, with managers limited to their projects. Aggregate totals use exactly the same company/role/filter scope as list rows, across the entire result rather than just the current page.

Submitting freezes content. Review must be by another authorized person, including when the worker is an owner. Rejection needs a note; resubmission increments a submission number. Each submission has at most one append-only decision recording reviewer, version, note and timestamp. Concurrent reviewers receive one success and one version conflict. APPROVED/VOID cannot be edited. Submitted version/state transitions, content and identity are additionally guarded by database triggers.

Migration007 adds two forced-RLS tables plus a company/task/project unique index needed for the composite time reference. Migration credentials must own the existing platform_tasks table to add that index. It changes no previously recorded migration SQL/checksum. Refresh restricted runtime grants after applying the versioned migration: entries SELECT/INSERT/UPDATE, approvals SELECT/INSERT. No DELETE or history-rewrite API exists. Trigger functions are invoker functions with fixed search_path and revoked PUBLIC execute; API authorization is still essential for the private shared runtime credential.

See docs/erp/TIMESHEETS_SPEC.md and TIMESHEETS_ACCEPTANCE.md. The local preview is a fictional verification database, not a commercial launch.
