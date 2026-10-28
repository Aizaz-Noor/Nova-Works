# Invoicing acceptance - 20 October 2026

Local codex/erp-foundation candidate; no push,deployment,customer email,bank call,charge orrefund. All bank references,company names andapproval evidence are fictional. Primary agent implemented and ran separate verification passes; no independent specialist review claimed.

| Check | Actual result |
| --- | --- |
| Backend |81tests passed,0failed,exit0 |
| Client production build |exit0 |
| Lifecycle and money |Source replay,exact order snapshots,role/tenant restrictions,draftversions,immutableissue,company numbering,MAXsafeintegerstrings,paymentreplay/currency/reference/date/overpayment,append-onlyreversals,fullcredit and replacement checks pass |
| Real PostgreSQL18.4 |Actual restricted LOGIN runtime; concurrent initialcreation/payment/reversal/credit/replacement each saves one logical result; parallel issuance assigns distinct consecutive company numbers; raw issuedrewrite/historymutation denied; no-contextRLS failsclosed; authenticated PDFs no-store; member/other-company PDF denial; ledger persists serverrestart |
| Upgrade |008 applied under NOSUPERUSER NOBYPASSRLS migration owner;15populated priorbusiness tables,includingapprovedtime/history andsalesorders, plus002-007checksums preserved; five newtables forceRLS; rerunidempotent |
| Edge actual UI |Acceptedorder Prepareinvoice -> draft -> actual409reloadpreserve -> issueINV000001 ->100.00USDpayment -> rejectedoverpayment with editable preservedinput -> reversal -> fullCN000001credit -> replacementINV000002 -> exact2938.68USDsettlement; original remainscredited andunmodified; refresh/search andactualPDFdownloads pass |
| Reflow |Invoice draft,issuedinvoice,paymenthistory,creditedinvoice,settledreplacement andinvoicelist at1366/768/375/320:24checks,no documentoverflow oruncaughtpageerrors; narrow paymenthistory visuallyinspected |
| PDF output |Invoice1page,credit1page,longinvoice7pages; all9pages rendered,contactsheet visuallyinspected,firstinvoicefullsize inspected. Requirednames/numbers/amounts,all24longitems,80termphrases,margins anditem/amountpagepairing pass |
| Restore |OnlineSQLite backup into freshrestoredfile matches26business tables,integrity/FKs pass. Actualinvoice/item/payment/credit/counter rows populated; unrelatedtime/customerhistory modules may be empty in this specific drill |

Commands: npm.cmd run test:all --prefix backend; npm.cmd run build --prefix app/client; node scripts/verify-local-postgres.mjs; node scripts/verify-invoicing-upgrade-postgres.mjs; node scripts/verify-invoicing-browser.mjs (PLAYWRIGHT_MODULE required,DEMO_URL defaults3024); bundledPython scripts/verify-invoicing-pdfs.py; node scripts/verify-invoicing-restore.mjs backend/data/invoicing-development.sqlite.

Ignoredtmp evidence: invoicing-backend-suite.log,postgres-checks/results.json,invoicing-upgrade/results.json,invoicing-browser/results.json,pdf-verification.json andpdf-rendered/contact-sheet.png,invoicing-restore-Oianru/results.json. PDF samples are invoice.pdf,credit.pdf,long-invoice.pdf in that browser folder.

Failures investigated before finalPASS: PostgreSQL source creation originally used FORUPDATE on append-only salesorders, which requires a deliberately absent UPDATEgrant. Replaced with a scoped advisory transactionlock, preserving grants. VisualPDF review found descriptions splitting from itemamounts; blockheight is now measured before pagination and per-page item/amount counts checked. Initial longtext verification counted a footer inside a split phrase; verifier removes only known pagefooters before comparing complete body text. Failed checks were not presented as acceptance.

Limits: basicLatinPDFfont only; unsupported text gives422 and remains intact online. No partialinvoices/credits,actualrefunds,paymentgateway,bankreconciliation,invoiceemails,rate/time-linkedbilling orcertifiedtax/accountingclaims. Credits cover the entire positive invoice only with zeroactivepayments. Hostedstaging andPostgreSQL disasterrecovery remain unverified. FullERP/launchgates remain open; the master-plan sequence next calls for commercialAI jobqueue/drafts/approval and operational usage controls.
