# Approved time invoicing — local acceptance

22October2026. Isolated codex/erp-notifications; original manual-testing checkout and public demo untouched. This milestone connects approved time to actual client invoices; the full ERP/commercial launch is still incomplete.

## Implemented business flow

Owner/admin chooses an active customer/project rate, selects up to50 approved billable entries, previews exact charges, creates a draft, issues and downloads it. Approval must be by another authorized reviewer and match the current approved submission/version. Eligibility is rechecked in the transaction. Unselected page entries are not priced; even an oversized unselected entry cannot hide other eligible time. Finance/tenant permissions and projects/timesheets/invoicing entitlements apply.

Each entry uses integer-minute × integer hourly minor amount /60 with per-entry HALF_UP, then rounded lines are summed. Zero rounded lines stay visible; ranges and mixed currency are rejected. TIME has zero tax with explicit No tax configured, not a legal exemption claim.

023 introduces explicit ORDER/TIME sources, immutable time roots/rate/minute/approval snapshots and unique company/time-entry allocations. Request fingerprints canonicalize sorted entry IDs. Same committed request returns the original invoice despite later rate edits; changed input conflicts. Deterministic PostgreSQL advisory entry locks and unique allocation constraints prevent overlapping requests billing twice. Audit failure rolls back root, allocation, invoice and items.

Crediting does not free time. TIME replacement retains the same root and snapshots, including originally blank customer email, while receiving a new generation/number. Existing ORDER creation/replacement remains unchanged. UI and PDF show actual minutes, hourly rate, work date and line totals, preserving ordinary order quantity/unit/tax presentation.

## Migration and access

SQLite023 preserves temporary copies of the invoice graph, drops guards, empties children then parent, reconstructs nullable-order/source-aware tables and restores all rows/guards inside migratePlatform's existing BEGIN IMMEDIATE transaction. Foreign keys remain enabled. An injected error after intermediate destructive DDL rolled back original rows/guards/checksums. This was tested only on disposable fixtures; no human-testing migration was performed.

PostgreSQL forward ALTER preserves historical rows. Migrator requires ownership authority for existing invoice table/source guards; restricted application runtime stays nonowner. Root/allocation forced RLS is finance-only, tenant-scoped; runtime SELECT/INSERT, no UPDATE/DELETE. Composite snapshot references, integer guards and generation/source checks protect stored history. Historical migration SQL is unchanged.

## Actual evidence

- SQLite populated022→023 preservation and injectedfailure rollback/repeat: node --test backend/test/time-billing-migration.test.js PASSexit0,1/1; preserves original order invoice generations/items/payment/reversal/credit/counters and foreign_key_check[].
- Service final6/6 PASSexit0,6945.604ms: independentapproval→draft→issue→credit/replacement, exact rounding, unchanged retry/current-rate changes, overlap/canonicalselection, role/entitlement/read-only, audit rollback, oversized unselected page entries and blank-email snapshot.
- Actual Edge browser worker logs/submits90minutes; independent reviewer approves; owner previews USD150.02 atUSD100.01/hour; simulated saved201→lost503→retry creates one invoice/allocation. Issues/downloads PDF; later currentrateUSD250.00 thencredit/replacement still shows original90minutes/USD100.01, oneallocation/twogenerations.5widths320/390/768/1024/1440 nooverflow/errors. PASSexit0 tmp/time-invoice-browser-1bzPiR/results.json. Earlier390px issued screenshot visually inspected.
- Downloaded PDF pypdf text assertions PASSexit0:90minutes/hourlyUSD100.01/workdate2026-01-10/no-taxconfigured/invoicetotalUSD150.02. This is content evidence, not comprehensive PDF typography/accessibility acceptance.
- Actual local PostgreSQL022→023 preserves22populatedprior tables/checksums/repeatnoop with nonbypassmigrator; freshrestrictedruntime privacy/rawdenial, exact15002,2service retry/overlap, auditrollback, rateeditreplay, issue/PDF/payment/reversal/fullcredit/concurrentreplacement snapshot/rebilldenial PASSexit0. tmp/time-billing-pg-83U0yC/results.json.
- Client build57modules PASSexit0,7.91s. Initial combinedrun found allocationtablename mismatch; fixed before focused/browser acceptance. Initial fullbackend144/144 PASSexit0,93076.0246ms before final eligibility edge; final suite/recovery follow below.

## Remaining gates

Final source-consistent backend regression and genuine ORDER+TIME PostgreSQL dump/restore are being verified. Hosted staging/human acceptance, partial-minute allocation or write-offs, billed-time adjustments, invoice taxes/discounts/localization and broader operational/security/load gates remain open. No invoices were sent or charges made. The local fixtures are fictional; no commercial/accounting compliance claim.

## Final regression and recovery

Final `npm.cmd run test:all --prefix backend`: PASSexit0,145passed/0failed/skipped,113961.7978ms; tmp/time-billing-backend-final.log. This includes final eligiblelisting/oversizedunselected-entry regression. Existing ORDER tests remain green.

Actual `node scripts/verify-time-billing-pgdump-restore.mjs`: PASSexit0,7.44s. Genuine18.6 customdump/singletransactionrestore54tables/24populated preserves every count/digest and priorchecksums. Fresh restrictedruntime actualthree-userHTTP bothORDER/TIME lists/details/PDF+creditPDF, existingreplacementretry/root/reserve, foreign404/managerfinance403. Historical90min@10001 remains15002 despitecurrentrate22222; newapproved90min previews33333 anddraft201/retry200. Evidence tmp/time-billing-pgdump-eLpbOU/results.json. Local nonTLS PostgreSQL only; attachmentobjects are not part of this invoice-specific drill (separate recovery evidence remains TASK_ATTACHMENTS_ACCEPTANCE.md).

Final browser replacement screenshot390px inspected:INV-000002 still90minutes/USD100.01hourly/USD150.02 afteroriginalcredit. Runtime/schema/service implementation accepted for these local cases. Hostedstaging/human/PDFtypographyandremainingfinance/commercial gates remainopen.
