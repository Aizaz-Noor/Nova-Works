# Sales module

Quotes and immutable sales orders form a connected operational sales workflow. Potential deal values are not quote totals, and sales orders do not recognize revenue or create invoices.

The server accepts canonical string minor units, whole quantities and integer tax basis points; it calculates line tax with half-up rounding using BigInt, then sums rounded lines. Supported currencies USD/GBP/PKR use two decimal places. All totals must fit 9007199254740991 minor units. Rates are explicitly supplied, not inferred tax advice or compliance logic.

A draft can be edited with the latest version. Issuing snapshots the customer's then-current name/email and freezes header terms and line items. A new quote revision supersedes the old quote, preserving history and preventing acceptance of old terms. Only owners/admins can record a customer decision, with an explicit reference. This is internal evidence recording; there is no authenticated customer portal or delivery email. Acceptance checks the current UTC expiry day and stores the accepting internal actor/time/reference.

Accepted quotes convert transactionally to one immutable sales order containing the exact approved quote version, header and line amounts. Conversions/revisions lock the source row and return the same result on retries after current ownership checks. Unique source keys prevent duplicates. Customer/deal locks follow the existing pipeline order. All successful mutations are audited; replay does not duplicate audit entries.

All four tables have forced company RLS. API membership/role/ownership checks remain essential because transaction context uses one private runtime credential. Database triggers additionally reject issued term/item changes, invalid quote transitions and any sales-order updates/deletes. The runtime receives SELECT/INSERT only on orders and their items; quote/item writes have scoped policies. Trigger functions are invoker functions with fixed search_path and no PUBLIC execute privilege. There is no SECURITY DEFINER bypass.

Migration006 is additive. Use the application version/checksum migration runner and separately refresh provision-runtime.sql; the SQL reference is for review, not a second migration mechanism. Previous checksums are unchanged. See docs/erp/QUOTES_SPEC.md and QUOTES_ACCEPTANCE.md for contract/evidence. Quotes use UUID identity in this slice; human document numbering, fractional quantities, discounts, PDFs, email and verified external approval remain later work.
