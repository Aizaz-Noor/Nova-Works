# NovaWorks ERP / CRM

NovaWorks brings customer relationships, sales, project delivery, approved time and invoicing into one workspace for service teams.

## Try the live demo

**Live application:** [nova-works-zeta.vercel.app](https://nova-works-zeta.vercel.app/)

Select **Explore demo workspace** to open the shared fictional sample company. The Owner and Manager roles show different views and permissions. Use sample data only; do not enter private customer information.

Recommended walkthrough: **Overview → Customers → Pipeline → Deals → Quotes / Sales orders → Projects & tasks → Timesheets → Invoices → Reports**.

The workflow tutorial is available at [docs/assets/novaworks-workflow-guide-20261028.mp4](docs/assets/novaworks-workflow-guide-20261028.mp4). It is an edited, captioned walkthrough using separate fictional local test data, not a continuous recording of the live company. [Overview](docs/assets/live-evaluation-20261028/overview.png) · [Pipeline](docs/assets/live-evaluation-20261028/pipeline-deals.png) · [Invoice](docs/assets/live-evaluation-20261028/invoice-details.png)

## Features

- Company-scoped customers, contacts, activities, leads and deals.
- Quotes and sales orders with recorded acceptance and preserved terms.
- Projects, tasks, assignments, milestones, comments and in-app notifications.
- Time entry, submission, independent approval and versioned billing rates.
- Order and approved-time invoices, PDF export, recorded payment evidence and credit/replacement history.
- Company reports, currency separation and role-aware navigation.
- Session authentication, membership and role checks, PostgreSQL row-level security and stale-edit protection.
- Meeting-to-project workflow retained from the original product.

NovaWorks is a demonstration ERP/CRM, not a complete accounting package. It does not include inventory, payroll, HR, purchasing, POS, general-ledger accounting or customer approval portals. Partial time allocation and partial invoice credits are not supported.

## Run the local demo

Requires Node.js 24. From the project root:

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix app/client
npm.cmd run build:client
npm.cmd run start:demo
```

Open **http://127.0.0.1:3048/** and select **Explore demo workspace**. Keep the terminal open while using NovaWorks; stop the server with Ctrl+C. The local demo uses its own fictional SQLite data. It does not connect to the hosted database, send email, charge cards or call a live AI provider.

For a configured server, see `backend/.env.example` and `docs/deployment/`. Keep credentials in a private environment file or host secret manager; never commit environment files, database dumps, access tokens or private keys.

## Technology

React 19, Vite 6, Node.js 24, Express 5, SQLite for local demo data, PostgreSQL for the hosted workspace, and Vercel hosting.

## Demo boundaries

The hosted sample workspace includes fictional business, project and invoice records. Payment entries are records of external receipts; NovaWorks does not move money. Live AI provider generation, durable hosted attachment storage, recovery email delivery and persistent workers are not configured or verified for this demo. Subscription billing is disabled.