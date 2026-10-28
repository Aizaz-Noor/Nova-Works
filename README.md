# NovaWorks ERP / CRM

NovaWorks is a service-business workspace that connects customer relationships, sales agreements, project delivery, approved effort and client invoices. It began as a meeting-to-project prototype and has since expanded into a multi-company ERP/CRM demonstration.

## Open the live demo

**Live application:** https://nova-works-zeta.vercel.app/

Sign in and select **Explore demo workspace** to use shared fictional sample data. Avoid entering private customer information.

| Role | Demo account | Access |
| --- | --- | --- |
| Owner | Owner demo | Select the owner role |
| Manager | Manager demo | Select the manager role |

Suggested flow: Overview → Customers → Pipeline → **Deals** → Quotes / Sales orders → Projects & tasks → Timesheets → Invoices → Reports. Pipeline opens on Leads; the seeded example opportunity is in Deals. The owner and manager see different permissions. The [midterm project analysis](docs/erp/MIDTERM_PROJECT_ANALYSIS_20261028.md) explains the screens, workflow, evidence and limitations.

### Demo data and boundaries

The hosted workspace contains fictional customer, project, sales and invoice records. Its invoice shows PKR85,000 issued, PKR15,000 recorded as received and PKR70,000 outstanding. Payment records document an external receipt; NovaWorks does not charge cards or transfer money. Do not enter private customer information.

The application includes Meeting AI review screens, but live provider generation was not verified for this release. Durable hosted attachment storage, recovery email delivery and persistent workers are not configured. Subscription billing is disabled. This is a demonstration, not a commercial-ready accounting or industry-wide ERP product.

## Workflow video and current screens

The silent, captioned [workflow tutorial](docs/assets/novaworks-workflow-guide-20261028.mp4) shows an edited end-to-end flow using separate fictional local QA data. It is not continuous real-time footage and does not show every click. Its example invoice is PKR100 with a PKR25 recorded receipt and PKR75 balance.

| Live screen | Capture |
| --- | --- |
| Company overview | [Overview](docs/assets/live-evaluation-20261028/overview.png) |
| Won sales opportunity | [Pipeline deals](docs/assets/live-evaluation-20261028/pipeline-deals.png) |
| Issued invoice and balance | [Invoice details](docs/assets/live-evaluation-20261028/invoice-details.png) |

## What is implemented

- Company-scoped CRM with customers, contacts, activities, leads and deals.
- Quotes, recorded acceptance and sales-order conversion with preserved issued terms.
- Projects, tasks, assignments, deadlines, milestones, comments and in-app notifications.
- Time entry, submission and independent approval, plus versioned billing rates.
- ORDER invoices from sales orders and TIME invoices from approved billable work.
- Invoice PDFs, recorded payment evidence, reversals and supported full-credit/replacement history.
- Company-scoped summaries, reports, currency separation and role-aware workspace navigation.
- Session authentication, company membership/role checks, PostgreSQL row-level security and stale-edit conflict handling.
- Meeting-to-project screens retained from the original prototype.

Not built as part of the current scope: inventory, payroll, HR, purchasing, POS, general-ledger accounting and a customer-facing approval portal. Partial time allocation and partial invoice credits are also not supported.

## Technology

- React 19, Vite 6, JavaScript and CSS.
- Node.js 24 and Express 5.
- SQLite for the isolated local demo; PostgreSQL on the hosted demo.
- Vercel hosting and Supabase PostgreSQL. Supabase provides database hosting; the Express application enforces user sessions and permissions.

## Run the isolated local demo

Use Node.js 24. From this folder, install the locked dependencies and start the separate fictional local workspace:

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix app/client
npm.cmd run build:client
npm.cmd run start:demo
```

Open **http://127.0.0.1:3048/** and choose **Explore demo workspace**. Keep the terminal open while using the app; stop it with Ctrl+C. The local database is separate from the hosted demo and older testing databases. It does not send email, charge cards or call a live AI provider.

For the ordinary configured server, see `backend/.env.example` and the deployment notes under `docs/deployment/`. Keep secrets in a private environment file or host secret manager. Never commit `.env` files, database dumps, session keys, access tokens or private certificates.

## Release and evidence

The current public deployment is `dpl_23Hc6wiNw9fasaMRbuBFWmxBkiRi` on the primary Vercel alias. On 28 October 2026, the public release verifier passed 59 checks with zero failures. The current database upgrade was preceded by an encrypted backup and a fresh local restore/rehearsal. The [release state](docs/erp/RELEASE_STATE.md) and [midterm analysis](docs/erp/MIDTERM_PROJECT_ANALYSIS_20261028.md) distinguish live observations from retained local tests and unverified integrations.

`SOURCE_MANIFEST.json` records the hashes of the published source set. Generated build output, dependencies, local demo databases and temporary test artifacts are excluded from source control.

## Original project context

The project originated in the Infinity Hack ’26 meeting-to-execution challenge: an administrator enters meeting notes, then reviews proposed projects, tasks, owners and deadlines. It later grew into the broader service-business ERP described above. The original company/team and meeting data are fictional.
