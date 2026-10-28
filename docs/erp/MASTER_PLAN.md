# NovaWorks ERP — Master Implementation Plan

Development Blueprint v1.0

19 October 2026

Objective: Transform your existing [NovaWorks GitHub project](https://github.com/Aizaz-Noor/Nova-Works?utm_source=chatgpt.com) into a secure, modular, commercially viable, AI-powered ERP SaaS platform that can be sold to companies worldwide.

This plan is designed for your existing React, Express and PostgreSQL codebase, with a small development team and AI-assisted coding.

The strategy is to build the ERP foundation once, launch revenue-generating modules first, and expand toward a complete ERP without needing to rewrite the architecture.

## 1. Product scope and development targets

RELEASE 1

# ERP Core

Identity, tenants, teams, CRM, projects

Foundation

RELEASE 2

# Commercial V1

Sales, timesheets, invoicing, AI, subscriptions

First paid release

RELEASE 3+

# Full ERP

HR, inventory, purchasing, accounting, payroll, POS

Expansion

### Development expectations

| Target                           | Planning estimate                                            |
| -------------------------------- | ------------------------------------------------------------ |
| Development model                | Modular monolith, multi-tenant SaaS                          |
| Main language                    | JavaScript initially, incremental TypeScript adoption        |
| Core team                        | 2–3 developers                                               |
| Commercial V1                    | Approximately 8–12 months part-time                          |
| Full multi-industry ERP          | Approximately 18–30+ months, depending on scope and staffing |
| Commercial V1 functional screens | 50–75                                                        |
| Expanded ERP functional screens  | 120–180+                                                     |
| Initial target market            | US/UK agencies, consultancies and IT service firms           |
| Commercial model                 | Monthly/annual subscriptions, implementation fees            |

These are planning ranges, not guaranteed delivery dates. Full accounting, payroll and country-specific compliance could take significantly longer.

## 2. Target product architecture

We'll retain your existing technology wherever sensible, but restructure the application so individual business modules can be developed independently.

NovaWorks Web Application

React • Shared design system • Responsive interfaces

Express API + Security Layer

Authentication • Tenant context • Authorization • Input validation

CRM

Sales

Projects

Finance

HR

Inventory

AI

Reports

Settings

PostgreSQL

Transactions, financial data and tenant isolation

Object Storage

Company files, invoices, attachments

Job Processing & Integration Layer

AI tasks • Emails • Reports • Payment webhooks • Scheduled jobs

### Technology decisions

| Component       | Recommendation                                                    |
| --------------- | ----------------------------------------------------------------- |
| Frontend        | React + Vite + TypeScript gradually                               |
| UI system       | Shared components, design tokens and accessibility standards      |
| Backend         | Node.js + Express 5                                               |
| Architecture    | Feature-based modular monolith                                    |
| Database        | Supabase-hosted PostgreSQL initially                              |
| Database access | Parameterized SQL with a consistent repository layer              |
| Authentication  | Extend secure session authentication; add MFA and recovery        |
| Authorization   | Organization-scoped RBAC plus database-level isolation            |
| File storage    | Private object storage and temporary signed URLs                  |
| Background jobs | Durable PostgreSQL-backed queue initially                         |
| AI              | Provider adapter with strict output validation and human approval |
| SaaS billing    | Paddle, subject to merchant approval                              |
| Monitoring      | Structured logging, error tracking, uptime monitoring             |
| Deployment      | Vercel for frontend/API if suitable; dedicated worker hosting     |
| Testing         | Node tests, API integration tests, Playwright browser tests       |
| CI/CD           | GitHub Actions                                                    |

Keep the current application running while changing its internals. No microservices, Kubernetes or unnecessary rewrite during the first releases.

Research on competing agency platforms supports the CRM → projects → time tracking → invoicing combination. For example, Productive markets these as interconnected operational capabilities rather than separate tools.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://productive.io\&sz=32)

productive.io



## 3. Module dependency and build order

We cannot develop the modules in arbitrary order. The platform services must exist before business modules can use them.

Platform Foundation

Organizations • Users • Security • Roles • Audit logs

CRM

Clients, leads and deals

Projects

Tasks and team delivery

Sales & Finance

Quotes, timesheets, invoicing

AI & Automation

Meeting extraction and actions

ERP Expansion

HR • Purchasing • Inventory • Accounting • Payroll • POS

Non-negotiable: Company isolation, permissions, migrations, backups and security tests come before introducing real paying customers.

OWASP ASVS 5.0 explicitly includes cross-tenant controls for multi-tenant applications, and Supabase documentation warns that privileged service roles can bypass Row Level Security. These requirements directly affect your existing backend design.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1



## 4. Database implementation plan

The current NovaWorks database contains users, projects, tasks, sessions, request limits and transcript submissions. We will migrate those into a commercial schema rather than simply adding unrelated tables.

### A. Core platform tables

| Table                              | Responsibility                                   |
| ---------------------------------- | ------------------------------------------------ |
| `organizations`                    | Customer company identity, status and settings   |
| `users`                            | Global user credentials and profiles             |
| `organization_memberships`         | Which users belong to which companies            |
| `roles`                            | Owner, admin, manager, employee, accountant      |
| `permissions` / `role_permissions` | Granular access permissions                      |
| `invitations`                      | Secure team invitations                          |
| `sessions`                         | Authenticated sessions                           |
| `audit_logs`                       | Security-sensitive and business activity history |
| `files`                            | File ownership, metadata and storage references  |
| `organization_settings`            | Currency, locale, timezone, numbering            |
| `feature_entitlements`             | Enabled subscription features and limits         |

### B. Business module tables

| Module     | Tables                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| CRM        | `customers`, `contacts`, `leads`, `deals`, `pipeline_stages`, `activities`            |
| Projects   | `projects`, `tasks`, `task_comments`, `task_history`, `milestones`, `project_members` |
| Sales      | `quotes`, `quote_items`, `sales_orders`, `sales_order_items`                          |
| Timesheets | `time_entries`, `time_approvals`, `billing_rates`                                     |
| Invoicing  | `client_invoices`, `invoice_items`, `payment_records`, `credit_notes`                 |
| AI         | `meetings`, `ai_jobs`, `ai_drafts`, `ai_approvals`, `ai_usage`                        |
| Billing    | `saas_subscriptions`, `billing_customers`, `billing_events`                           |
| Reports    | Aggregation queries and materialized views where needed                               |

### C. Future ERP tables

| Module     | Tables                                                             |
| ---------- | ------------------------------------------------------------------ |
| HR         | `employees`, `departments`, `leave_requests`, `attendance_records` |
| Inventory  | `products`, `warehouses`, `stock_movements`, `stock_reservations`  |
| Purchasing | `suppliers`, `purchase_orders`, `goods_receipts`, `supplier_bills` |
| Accounting | `accounts`, `journal_entries`, `journal_lines`, `fiscal_periods`   |
| Payroll    | `payroll_periods`, `payslips`, `earnings`, `deductions`            |
| Automation | `workflow_definitions`, `workflow_runs`, `workflow_events`         |

### Database design rules

- Every tenant-owned table must have an `organization_id`, directly or through rigorously enforced ownership.
- Foreign keys must prevent cross-company references, not just invalid record IDs.
- Records should use stable UUIDs and appropriate uniqueness constraints.
- Financial amounts need exact numeric representation and currency codes.
- Business records need creation/update timestamps, ownership, and audit history where appropriate.
- Financial records must use controlled reversal/correction workflows rather than unrestricted deletion.
- Database migrations must be versioned, reviewable and backward-compatible during deployment.

### Migration from your existing database

Use a safe expand–migrate–verify–contract strategy.

1. Create a backup and independently test its restoration.
2. Create a dedicated Demo Organization.
3. Add organization and membership structures without deleting existing tables.
4. Backfill ownership for the existing fictional users, projects and tasks.
5. Introduce new tenant-aware queries and endpoints.
6. Test old and new workflows while the schema transitions.
7. Enable strict constraints and tenant protection after the data is valid.
8. Remove legacy fields only in a later, separately reviewed migration.

The existing public demonstration must remain segregated from all commercial customer accounts.

## 5. Backend implementation standards

Each ERP module will follow the same structure:

```
backend/src/
├── platform/
│   ├── auth/
│   ├── organizations/
│   ├── authorization/
│   ├── audit/
│   ├── database/
│   ├── files/
│   ├── jobs/
│   └── billing/
├── modules/
│   ├── crm/
│   │   ├── crm.routes.js
│   │   ├── crm.controller.js
│   │   ├── crm.service.js
│   │   ├── crm.repository.js
│   │   └── crm.schema.js
│   ├── projects/
│   ├── sales/
│   ├── timesheets/
│   ├── invoicing/
│   ├── hr/
│   ├── inventory/
│   └── ai/
└── app.js
```

The basic responsibilities:

| Layer             | Responsibility                                 |
| ----------------- | ---------------------------------------------- |
| Routes            | Define API endpoints                           |
| Controller        | Handle HTTP requests and responses             |
| Validation schema | Validate incoming data                         |
| Service           | Implement actual business rules                |
| Repository        | Access the database with tenant-scoped queries |
| Authorization     | Confirm access to action and resource          |
| Tests             | Verify behavior, failures and permissions      |

Use consistent response shapes, standardized errors, pagination, filtering, transaction boundaries and audit hooks.

### Proposed API contracts

Representative API endpoints

| `POST`  | `/api/v1/organizations`   | Create workspace         |
| ------- | ------------------------- | ------------------------ |
| `POST`  | `/api/v1/invitations`     | Invite member            |
| `GET`   | `/api/v1/contacts`        | List CRM contacts        |
| `POST`  | `/api/v1/deals`           | Create sales opportunity |
| `POST`  | `/api/v1/projects`        | Create project           |
| `PATCH` | `/api/v1/tasks/:id`       | Update task              |
| `POST`  | `/api/v1/time-entries`    | Record hours             |
| `POST`  | `/api/v1/client-invoices` | Create draft invoice     |
| `POST`  | `/api/v1/ai/jobs`         | Submit AI processing job |

Proposed contracts. No routes above should be treated as implemented yet.

Each protected endpoint must resolve the user's company from trusted server-side context, not simply trust an arbitrary organization ID in the request body.

## 6. Frontend implementation and screen planning

We'll build a reusable design system first, followed by pages, forms and dashboards.

### Shared components

Create reusable components for navigation, headers, page titles, search, tables, forms, filters, badges, tabs, modals, drawers, calendars, notifications, pagination, chart containers, date pickers, file uploads and permission-aware actions.

This avoids building separate design patterns for every ERP module.

### Commercial V1 screen allocation

| Module                      | Screen target | Primary views                                                                                    |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| Authentication & onboarding | 7             | Login, registration, verification, password recovery, company setup, invitation, first-run setup |
| Dashboard                   | 3             | Overview, personal workspace, management dashboard                                               |
| CRM                         | 9             | Customers, contact details, leads, deal pipeline, activity history                               |
| Project management          | 11            | Project list/details, board, tasks, task details, milestones, templates                          |
| Sales & quotations          | 5             | Quotes list, editor, detail, customer approval, sales order                                      |
| Timesheets                  | 4             | My timesheet, approvals, team hours, billable summary                                            |
| Invoicing                   | 7             | Invoice list/editor, details, payments, credit notes, settings                                   |
| AI workspace                | 5             | Meetings, upload/input, review, history, usage                                                   |
| Team management             | 4             | Members, invitations, roles, member details                                                      |
| Settings & subscription     | 7             | Organization, billing, preferences, security, integrations                                       |
| Reports                     | 3             | Sales, delivery and financial overview                                                           |
| Total                       | 65            | Functional screens                                                                               |

A screen is a distinct functional view; responsive variants, dialogs and error states will create more design frames, but should not all become separate pages.

### Frontend delivery sequence

Use this order:

Foundation UI → Authentication → Organization Dashboard → CRM → Projects → Timesheets → Sales/Invoices → AI → Reports → Billing/Settings.

Do not build 65 decorative screens first. Every completed screen should already connect to its working API and database functionality.

## 7. Business rules that must be correct

A commercial ERP is defined as much by its business logic as by its UI.

| Area                    | Essential rules                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Organization membership | A user may belong to multiple companies but can only act within the selected authorized company               |
| CRM                     | Contacts and deals have clear ownership, lifecycle stages and activity history                                |
| Projects                | Only permitted users can assign tasks, change deadlines or mark milestones complete                           |
| Time tracking           | Hours require valid users/projects, and approved or invoiced hours are protected against unauthorized editing |
| Quotations              | Accepted quotes retain the approved terms and correct version                                                 |
| Invoicing               | Invoice numbering, currency, totals, corrections and payment allocation are controlled                        |
| Finance                 | Project revenue and costs must be calculated from authoritative records                                       |
| AI                      | AI results are drafts until approved; provider failures must not create partial business records              |
| Billing                 | Subscription state controls feature access, with a documented grace-period policy                             |
| Inventory               | Every stock change must have an auditable movement record                                                     |
| Accounting              | Posted journal entries must balance; closed periods must not be silently edited                               |

For international sales, taxes, currencies, timezones and date formats need deliberate design. Start with English and a limited set of supported currencies and invoice configurations. Don't claim certified accounting compliance for every country.

## 8. Full implementation schedule — 18 sprints

I recommend two-week sprints. The schedule below assumes a small team with consistent part-time availability.

| Sprint | Weeks | Implementation milestone                                    | Expected output                   |
| ------ | ----- | ----------------------------------------------------------- | --------------------------------- |
| 1      | 1–2   | Repository cleanup, ownership, architecture, requirements   | Approved technical specifications |
| 2      | 3–4   | Organizations, memberships and migration framework          | Multi-tenant schema               |
| 3      | 5–6   | RLS, tenant-aware access and isolation testing              | Secure data boundaries            |
| 4      | 7–8   | Signup, invitations, roles and account recovery             | Working organization onboarding   |
| 5      | 9–10  | Projects, manual CRUD and task status management            | Functional project workspace      |
| 6      | 11–12 | Comments, attachments, milestones and notifications         | Complete task workflow            |
| 7      | 13–14 | CRM customers, contacts and imports                         | Working customer database         |
| 8      | 15–16 | Leads, deals, sales pipeline and follow-ups                 | Functional CRM pipeline           |
| 9      | 17–18 | Quotations, quote approvals and conversions                 | Sales quotation workflow          |
| 10     | 19–20 | Timesheets, billable hours and approvals                    | Time tracking                     |
| 11     | 21–22 | Client invoices, PDFs, payments and corrections             | Functional billing workflow       |
| 12     | 23–24 | AI job queue, structured drafts and human approval          | Commercial AI workflow            |
| 13     | 25–26 | Dashboards, reports, imports and exports                    | Business analytics                |
| 14     | 27–28 | SaaS subscription billing and entitlements                  | Paid plan infrastructure          |
| 15     | 29–30 | Admin controls, data lifecycle and operational tooling      | Commercial administration         |
| 16     | 31–32 | Security, performance, backup and disaster recovery testing | Release candidate                 |
| 17     | 33–34 | Private beta and customer feedback                          | Validated pilot workflows         |
| 18     | 35–36 | Fixes, documentation and controlled paid rollout            | Commercial V1                     |

Milestone overview

Foundation and security

Sprints 1–4

Core ERP business workflows

Sprints 5–11

AI, reporting and billing

Sprints 12–15

Hardening and commercial release

Sprints 16–18

The bars represent planned cumulative schedule milestones rather than completed work.

We can recruit design-partner businesses much earlier than sprint 17. Ideally, the first companies should be testing the project-management and CRM workflows as soon as they're safe enough for controlled pilot use.

## 9. Commercial security implementation

Your ERP will handle business-critical data. Security must be part of each sprint, not an activity postponed until the final release.

Use [OWASP ASVS 5.0](https://github.com/OWASP/ASVS?utm_source=chatgpt.com) as the primary application security checklist. Its authorization requirements explicitly cover cross-tenant access and administrative privileges.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub



### Security checklist

Security implementation tracker

0/12

Passwords, reset links and session management are secure

Organization membership is verified server-side

Cross-tenant API and database access is blocked

Database role cannot bypass tenant security policies

State-changing requests have CSRF protection

Administrative actions use MFA or appropriate step-up authentication

Secrets are stored outside source control

Sensitive files require authorized access

All important business changes are auditable

AI outputs cannot bypass user permissions

Customer data exports and deletion are controlled

Backup restoration is tested

Security tests must cover more than ordinary requests. Test guessed IDs, bulk endpoints, exports, file downloads, background jobs, webhook handling, search results and reports for authorization mistakes.

For international customers, also prepare terms of service, a privacy policy, appropriate data-processing agreements, subprocessors documentation and data-retention controls. EU/EEA customers may require specific contractual arrangements and international transfer safeguards.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://commission.europa.eu\&sz=32)

commission.europa.eu

+1



## 10. SaaS billing and subscription implementation

Keep these two systems completely separate:

- NovaWorks subscriptions: Your customers pay you for using NovaWorks.
- ERP client invoicing: Your customers create invoices for their own customers.

For your SaaS business, introduce subscription plans and feature entitlements.

| Entitlement           | Starter         | Growth             | Agency Pro       |
| --------------------- | --------------- | ------------------ | ---------------- |
| Organization accounts | 1               | 1                  | 1                |
| Included users        | 3               | 10                 | 25               |
| CRM                   | Yes             | Yes                | Yes              |
| Projects              | Yes             | Yes                | Yes              |
| Timesheets            | Limited         | Full               | Full             |
| AI usage              | Small allowance | Standard allowance | Higher allowance |
| Advanced reports      | —               | Yes                | Yes              |
| Approval workflows    | —               | Limited            | Full             |
| Support               | Standard        | Standard           | Priority         |

These are proposed plan limits, not finalized commercial packages.

### Billing implementation

Build a server-side subscription service that stores payment-provider customer IDs, subscription IDs, statuses, plan entitlements and usage counters.

Implement webhook signature verification, idempotent event handling, event-order reconciliation and safe retries. Paddle documents that its webhooks can arrive more than once or out of order, and recommends using event IDs and event timestamps to handle those cases.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.paddle.com\&sz=32)

Paddle Developer Docs

+1



Plan for trial, active, past-due, cancelled, expired and grace-period states. Define what happens to data when a company cancels: read-only access, export window, retention and eventual deletion must be predictable.

Paddle lists Pakistan outside its unsupported supplier countries, but you still need successful merchant onboarding and product approval before depending on it for launch.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.paddle.com\&sz=32)

Paddle



## 11. Quality assurance and release pipeline

Every module should pass several testing layers.

| Test category       | What must be verified                                            |
| ------------------- | ---------------------------------------------------------------- |
| Unit tests          | Validation, pricing formulas, role decisions, business rules     |
| Integration tests   | Database transactions, APIs, tenant restrictions                 |
| End-to-end tests    | Real login, CRM, projects, invoices and subscription flows       |
| Migration tests     | Upgrade from older schema without losing data                    |
| Security tests      | Cross-tenant access, role escalation, injection, CSRF            |
| AI tests            | Malformed responses, provider outages, prompt injection, retries |
| Performance tests   | Concurrent users, large tables, database queries                 |
| Recovery tests      | Backup restoration, interrupted jobs, service outages            |
| Accessibility tests | Keyboard use, labels, focus and responsive behavior              |
| Billing tests       | Duplicate/out-of-order webhooks, failed charges, cancellation    |

### GitHub workflow

Every feature should follow this process:

GitHub Issue + Acceptance Criteria

Feature Branch

Implementation + Automated Tests

Pull Request + Code Review

CI Checks + Staging Verification

Merge + Controlled Deployment

Create branch protections and require successful tests before merging to `main`. Database changes must be reviewed for compatibility and rollback impact.

### Definition of Done

A feature is complete only when:

- Its business rules and user interface work together.
- Its authorization and tenant isolation are tested.
- Inputs, loading states, errors and empty states are handled.
- Automated regression tests pass.
- Accessibility and reasonable performance are checked.
- Relevant documentation is updated.
- It has been reviewed and demonstrated on staging.

This definition will help prevent a common AI-assisted development problem: a feature looks complete visually but fails under real business conditions.

## 12. Complete ERP expansion — after Commercial V1

Once the focused agency platform has paying customers and stable operations, expand toward the broader ERP vision.

| Expansion stage | Modules                                                | Implementation focus                  |
| --------------- | ------------------------------------------------------ | ------------------------------------- |
| V2.0            | HR, employee management, leave, resource planning      | Company workforce operations          |
| V2.1            | Expenses, vendors, purchasing                          | Procurement and approvals             |
| V2.2            | Products, warehouses, inventory                        | Reliable stock movements and costing  |
| V3.0            | Accounting and financial statements                    | Proper double-entry accounting        |
| V3.1            | Payroll and fiscal localization                        | Country-specific compliance           |
| V3.2            | CounterFlow POS integration                            | Restaurant and retail operations      |
| V4.0            | Workflow automation, advanced analytics, external APIs | Ecosystem and enterprise capabilities |

Do not create fake accounting by adding income and expense cards to the dashboard. Proper accounting needs a balanced ledger, immutable posted entries, reconciliation, fiscal periods and appropriate regulatory controls.

Inventory similarly requires stock movements, adjustments, reservations and valuation rules rather than a manually edited quantity field.

This is why these modules should have separate technical specifications, acceptance tests and pilot customers.

## 13. How to divide work among your team

Based on the existing contributions described in the repository, the following would be a practical allocation, assuming the team agrees to continue commercially.

| Role                                | Responsibilities                                                         |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Product lead / frontend integration | Requirements, product design, React UI, release coordination             |
| Backend engineer                    | Database, tenant isolation, authentication, modules and APIs             |
| AI/QA engineer                      | AI workflows, automated testing, monitoring and integration verification |

Everyone should contribute to reviews. Authentication, financial calculations and database isolation need particular scrutiny.

Before commercialization, agree in writing on the original team's ownership, contributions, licensing and any future revenue-sharing arrangements. A public GitHub repository alone does not establish commercial reuse rights for all team contributions.

## 14. The first implementation milestone — start here

Don't begin with 65 screens or a full ERP dashboard. The first milestone should be called:

Milestone 1: NovaWorks Multi-Tenant SaaS Foundation

Here's the exact initial work package for your repository.

| Task ID | Work item                                                     | Priority |
| ------- | ------------------------------------------------------------- | -------- |
| NW-001  | Audit current source and preserve a working baseline          | P0       |
| NW-002  | Resolve commercial code ownership and contribution terms      | P0       |
| NW-003  | Define product specification and tenant architecture          | P0       |
| NW-004  | Create a dedicated development branch and staging environment | P0       |
| NW-005  | Add versioned database migration tooling                      | P0       |
| NW-006  | Introduce `organizations` and membership tables               | P0       |
| NW-007  | Safely migrate existing demo data                             | P0       |
| NW-008  | Introduce tenant-aware session context and authorization      | P0       |
| NW-009  | Enforce tenant boundaries at database level                   | P0       |
| NW-010  | Implement cross-tenant automated tests                        | P0       |
| NW-011  | Add organization creation and membership APIs                 | P1       |
| NW-012  | Add secure company onboarding and invitations                 | P1       |

### Milestone 1 acceptance test

Create two test companies:

Company A

Alpha Digital

2 users

3 projects

Company B

Beta Consulting

3 users

2 projects

Verify that each company can manage its own users and projects, cannot read or modify the other's records, and cannot leak data through AI drafts, file references or exports.

Then sign out, restart the backend and verify that all authorized records persist.

Only after this milestone passes should we start the new CRM and ERP business modules.

## 15. Final implementation priorities

NovaWorks ERP development order

Recommended

1. Secure SaaS foundation

   Multi-tenancy, organizations, users, authentication, permissions and backups.
2. Operational ERP core

   CRM, clients, projects, tasks, activities and team management.
3. Financial workflows

   Quotes, time tracking, client invoicing, payment status and reporting.
4. AI and automation

   Meeting intelligence, reviewed business actions, notifications and background processing.
5. Commercial readiness

   Subscriptions, onboarding, security testing, privacy controls, support and pilot customers.
6. Full ERP capabilities

   HR, inventory, purchasing, accounting, payroll, POS and specialized industry modules.

This is the implementation sequence I would adopt for NovaWorks. It preserves your current working AI project-management foundation, establishes the security model needed for global customers, and turns the product into a real ERP through interconnected business workflows.

The immediate next engineering deliverable is the multi-tenant architecture and migration plan. It should be implemented on a separate branch with passing tests and without changing the production demo until the upgrade is verified.

The roadmap above is the proposed plan; no repository changes or deployments have been made as part of this planning step.