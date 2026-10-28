# Leads and deals slice

The next approved CRM workflow is lead → qualified relationship → deal → won delivery.
These are potential sales records, not recognized revenue, invoices or accounting entries.

## Operating flow

1. A company owner, administrator or manager records a lead and optional follow-up date.
2. Qualify the lead, then convert it into a prospect customer, contact and new deal.
   An editable existing customer may be selected instead of creating another one.
3. Record a potential value and currency, and move the opportunity through the pipeline.
4. Close as won or lost. Lost opportunities require a reason. Closed deals remain read-only.
5. For a won deal, explicitly create a delivery project with its own manager and deadline.
   The sales close date is not inferred to be a delivery deadline.

## Business and security rules

- All records and foreign keys are company-scoped. Each operation revalidates the
  authenticated user's membership. Ordinary members have no sales-pipeline access.
- Owners/admins manage company records. Managers edit only their own leads/deals and
  must have permission on any related customer or project they change.
- Lead states: NEW, QUALIFIED, DISQUALIFIED, CONVERTED. Conversion requires QUALIFIED;
  converted leads are read-only and retain their source/customer/contact references.
- Default deal stages: NEW, QUALIFIED, PROPOSAL, WON, LOST. Open deals can move between
  these stages. Terminal deals are immutable through ordinary edit endpoints.
- Follow-up and close/delivery dates use real ISO calendar dates. No email or reminder
  service is activated in this slice; dates are visible for manual follow-up.
- Deal potential amounts use exact minor-unit integer strings or null when unknown.
  Supported currencies initially: USD, GBP, PKR. Decimal input is parsed with integer
  arithmetic; no floating-point multiplication by100. Do not aggregate currencies.
- Version checks reject stale edits. Conversion and won-project creation are atomic,
  safe under concurrent requests, and replay their existing result instead of duplicating it.
- Creating a project also creates the customer/project and deal/project references in
  the same transaction. Every actual business mutation appends an audit event.
- Paginate and filter after tenant/role scope, validate permitted fields and reject NULs.
- Add migration005 without changing applied002–004 SQL. Seed existing and new companies'
  stages, enforce forced PostgreSQL RLS, and extend reviewed runtime grants only as needed.

## Evidence required

Service/API tests must cover role and company denials, stale edits, conversion/project
replay, concurrent conversion, lost reasons, date validation and exact amount handling.
Run the same essential flow on real restricted PostgreSQL, including raw RLS queries,
foreign-key denials, rollback on a failed conversion and restart persistence.

Browser acceptance must exercise the complete lead-to-project flow, money display,
retry/refresh behavior, keyboard focus and narrow layouts. Verify restoration of actual
lead/deal/project-link records into a fresh local test database.

Quotations, invoice creation, payments, forecasting and financial reports remain later slices.
