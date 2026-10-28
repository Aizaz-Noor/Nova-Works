# NovaWorks

**Customer relationships, sales and project delivery in one workspace.** NovaWorks is a service-business ERP/CRM that connects a lead to a customer, an accepted sales order, assigned delivery work, approved time and an invoice.

[Open the live demo](https://nova-works-zeta.vercel.app/) · [Watch the workflow](docs/assets/novaworks-workflow-guide-20261028.mp4)

## Explore the workflow

Choose **Explore demo workspace** to open the shared fictional sample company. The Owner and Manager roles show different views and permissions. Use sample data only; do not enter private customer information.

**Overview → Customers → Pipeline → Deals → Quotes / Sales orders → Projects & tasks → Timesheets → Invoices → Reports**

The video is an edited, captioned walkthrough using separate fictional local data. It is not a continuous recording of the live company. [Overview](docs/assets/live-evaluation-20261028/overview.png) · [Pipeline](docs/assets/live-evaluation-20261028/pipeline-deals.png) · [Invoice](docs/assets/live-evaluation-20261028/invoice-details.png)

## What it includes

- Company-scoped customers, contacts, activities, leads and deals.
- Quotes and sales orders with recorded acceptance and preserved terms.
- Projects, assigned tasks, milestones, comments and notifications.
- Time entry, submission, independent approval and billing rates.
- Order and approved-time invoices, PDF export, payment records and credit history.
- Company reports, currency separation and role-aware navigation.
- Session authentication, membership and role checks, PostgreSQL row-level security and stale-edit protection.
- Meeting-to-project workflow from the original product.

NovaWorks is a demonstration, not a complete accounting package. Inventory, payroll, HR, purchasing, POS, general-ledger accounting and customer approval portals are outside its scope. It does not move money. Live AI generation, recovery email, durable hosted attachments and persistent workers are not configured for the public demo.

## Run locally

Requires Node.js 24 and npm. From the repository root:

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix app/client
npm.cmd run build:client
npm.cmd run start:demo
```

Open **http://127.0.0.1:3048/** and select **Explore demo workspace**. The local demo uses its own fictional SQLite data under `tmp/`; it refuses hosted database or production configuration. Keep the terminal open while using it and press Ctrl+C to stop.

## Technology

React 19 · Vite 6 · Node.js 24 · Express 5 · SQLite for the local demo · PostgreSQL for the hosted workspace · Vercel

## Documentation

- [Developer guide](docs/README.md)
- [Testing](docs/TESTING.md)
- [Workflow tutorial notes](docs/WORKFLOW_TUTORIAL.md)
- [Deployment guides](docs/deployment/README.md)

Keep local credentials in an untracked `backend/.env` file or a hosting secret manager. Never commit database URLs, session secrets, provider keys, private certificates or database backups.
