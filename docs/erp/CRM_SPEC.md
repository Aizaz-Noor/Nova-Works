# CRM working slice

Approved roadmap: agency/service-business ERP; extend the existing modular monolith.
This slice connects company customers, contacts, activity history and existing delivery projects.
No marketing dashboard, lead scoring, email sending or financial claims are included.

## User flow

Select an authorized company → Customers → create customer → record its contacts and
meeting/call notes → link an existing delivery project → edit/maintain the customer.
Search, pagination, empty/loading/error states and refresh persistence must work.

## Data and rules

- Customers belong to one organization and a management-role member. Lifecycle:
  PROSPECT, ACTIVE, ARCHIVED. Name required; email/phone/website/notes optional.
- Contacts belong to one existing customer in the same company. Name required.
- Activities are append-only NOTE/CALL/MEETING entries with actor and timestamp.
- A project may link to one customer. Both references must belong to the same company.
  Repeating the same link is safe; moving a link to another customer needs an explicit future workflow.
- Owners/admins can edit company customers; managers edit only customers they own.
  Members have no CRM access. Company membership is revalidated on each request.
- Customer edits require the displayed version and return409 when another edit wins.
  Preserve user input and provide a clear reload action on conflict.
- Every business mutation appends an audit record in its transaction.
- Search and totals apply after tenant/role scope. Bound lists to100 records per page.
- Validate email, text lengths, allowed fields and http/https websites. Reject unsafe schemes.
- Use additive migration004 with composite company foreign keys and PostgreSQL forced RLS.
  Do not alter applied002/003 migration checksums or broaden runtime privileges.

## Required proof

SQLite service+HTTP tests: create/edit/contact/activity/link; wrong company/member;
wrong owner; stale version; invalid fields; bounded search and persistence.
Real PostgreSQL restricted runtime: same flow, raw RLS and cross-company link denial,
concurrent version conflict, migration from existing foundation.
Real browser: creation/edit/contact/note/link/search/refresh plus narrow-screen and keyboard checks.
Existing company/project/task/demo regressions must remain passing.

Broader CRM leads, deals, pipelines, imports and sales conversion remain later roadmap work.
