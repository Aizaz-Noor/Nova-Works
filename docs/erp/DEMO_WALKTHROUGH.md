# NovaWorks walkthrough

This is a manual inspection guide, not a completed video or evidence that these browser actions passed. Use the new local fictional demo, not the hosted public site or the older human-testing database.

Public fictional demo accounts only (these are not production credentials):

| Account | Email | Password |
| --- | --- | --- |
| Company owner | `owner@demo.novaworks.test` | `NovaWorksDemo2026!` |
| Manager/reviewer | `reviewer@demo.novaworks.test` | `NovaWorksReview2026!` |

The Explore button enters the owner account. To inspect the manager's permitted work, sign out and use the reviewer account in the ordinary sign-in form.

1. Start the app using the root README. Open http://127.0.0.1:3048/ and choose Explore demo workspace. Confirm the fictional company name, then inspect Overview.
2. Open Customers. Inspect a seeded customer; add a fictional contact or activity. Refresh and confirm the saved change remains.
3. Open Sales. Inspect a lead/deal, quote and sales order. Quote issue/approval/conversion are explicit actions; observe the required status and version checks. A saved sales record is not money collected.
4. Open Projects. Inspect a project's manager, tasks, deadline and estimates. Change a task through the available controls, then refresh to check persistence.
5. Open Time. Create and submit a small fictional entry. Use a separate eligible reviewer to approve it; self-approval must be refused. Existing approved sample time is a seed precondition, not a new approval performed during this walkthrough.
6. Open Invoices. Inspect a numbered invoice, source lines, currency and balance. Download its authenticated PDF. Record a fictional manual payment only if testing that operation; it does not charge a card. Inspect correction/history controls before using them.
7. Open Reports. Compare delivery/sales/invoice results with saved records. Keep currencies separate. Refresh and export the available report.
8. Open Meetings. Live AI is disabled in this local demo. Inspect available meeting/review controls without presenting a seeded or simulated draft as a live extraction. Provider acceptance remains a separate unfinished check.
9. Open Settings. Inspect company/team controls and your account settings. Sign out and enter again; confirm the same local saved records remain.

## Recording status

Requested new video: **NOT CREATED**. Browser access to the local app was explicitly denied by the browser security policy, including indirect/alternate browser workarounds. No synthetic UI, old recording, storyboard or HTTP test is being substituted for actual capture. A genuine recording should show the current build, readable labels, real saves, refresh/persistence and the limitations above. Only record after an approved capture route is available.
