import { hashPassword } from './services/passwords.js';
import { createPlatformService } from './platform/service.js';
import { createTaskService } from './modules/projects/taskService.js';
import { createCrmService } from './modules/crm/service.js';
import { createPipelineService } from './modules/pipeline/service.js';
import { createSalesService } from './modules/sales/service.js';
import { createTimesheetService } from './modules/timesheets/service.js';
import { createInvoiceService } from './modules/invoicing/service.js';

const localDemoDescriptor = Object.freeze({
 email: 'owner@demo.novaworks.test',
 password: 'NovaWorksDemo2026!',
 organizationId: '10000000-0000-4000-8000-000000000001',
 companyName: 'NovaWorks Service Studio'
});
const reviewer = Object.freeze({
 id: '10000000-0000-4000-8000-000000000007',
 email: 'reviewer@demo.novaworks.test',
 password: 'NovaWorksReview2026!',
 name: 'NovaWorks Demo Reviewer'
});
const ownerId = '10000000-0000-4000-8000-000000000002';

export { localDemoDescriptor };

export function isLoopbackSocket(address) {
 if (typeof address !== 'string') return false;
 const normalized = address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : address;
 return normalized === '::1' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

export function validateLocalDemoActivation({ localDemo, db, production, erpEnabled, enabled }) {
 if (!localDemo) {
  if (enabled) throw new Error('Local demo requires its explicit server configuration');
  return false;
 }
 const keys = Object.keys(localDemo).sort();
 const expectedKeys = ['email', 'password', 'organizationId', 'companyName'].sort();
 if (JSON.stringify(keys) !== JSON.stringify(expectedKeys) || Object.entries(localDemoDescriptor).some(([key, value]) => localDemo[key] !== value)) {
  throw new Error('Local demo credentials and company must use the fixed fictional fixture');
 }
 if (production || process.env.NODE_ENV === 'production') throw new Error('Local demo cannot run in production');
 if (!enabled) throw new Error('Local demo requires explicit LOCAL_DEMO_ENABLED configuration');
 if (!erpEnabled) throw new Error('Local demo requires ERP mode');
 if (db?.kind === 'postgres' || typeof db?.prepare !== 'function') throw new Error('Local demo requires an isolated SQLite database');
 try { assertLocalDemoDatabase(db); }
 catch { throw new Error('Local demo requires its marked isolated fixture database'); }
 return true;
}

export function assertLocalDemoDatabase(db) {
 if (db?.kind === 'postgres' || typeof db?.prepare !== 'function') throw new Error('Local demo requires SQLite');
 const meta = db.prepare("SELECT value FROM local_demo_meta WHERE key='fixture'").get();
 if (meta?.value !== 'novaworks-local-demo-v1') throw new Error('Database is not a marked NovaWorks local demo fixture');
}

// Called only for a newly created database after all platform migrations succeed.
// Service writes preserve the product's normal validation and tenant invariants.
export async function seedLocalDemo(db) {
 if (db?.kind === 'postgres' || typeof db?.prepare !== 'function') throw new Error('Local demo seeding requires SQLite');
 const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='local_demo_meta'").get();
 if (exists) throw new Error('Refusing to seed an existing or partially initialized database');
 const time = new Date().toISOString();
 db.exec('BEGIN IMMEDIATE');
 try {
  db.exec("CREATE TABLE local_demo_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
  db.prepare("INSERT INTO local_demo_meta(key,value) VALUES('fixture','novaworks-local-demo-v1')").run();
  const insertUser = db.prepare('INSERT INTO users(id,name,email,password_hash,role,specialization,skills) VALUES(?,?,?,?,?,?,?)');
  insertUser.run(ownerId, 'NovaWorks Demo Owner', localDemoDescriptor.email, hashPassword(localDemoDescriptor.password), 'ADMIN', 'Service business owner', JSON.stringify(['customer relationships', 'delivery planning']));
  insertUser.run(reviewer.id, reviewer.name, reviewer.email, hashPassword(reviewer.password), 'MANAGER', 'Delivery reviewer', JSON.stringify(['quality review', 'time approval']));
  db.prepare('INSERT INTO platform_organizations(id,name,created_by,created_at) VALUES(?,?,?,?)').run(localDemoDescriptor.organizationId, localDemoDescriptor.companyName, ownerId, time);
  db.prepare('INSERT INTO platform_memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)').run(localDemoDescriptor.organizationId, ownerId, 'OWNER', time);
  db.prepare('INSERT INTO platform_memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)').run(localDemoDescriptor.organizationId, reviewer.id, 'MANAGER', time);
  for (const [code, name, position] of [['NEW','New',1],['QUALIFIED','Qualified',2],['PROPOSAL','Proposal',3],['WON','Won',4],['LOST','Lost',5]]) {
   db.prepare('INSERT OR IGNORE INTO platform_pipeline_stages(organization_id,code,name,position) VALUES(?,?,?,?)').run(localDemoDescriptor.organizationId, code, name, position);
  }
  db.exec('COMMIT');
 } catch (error) {
  db.exec('ROLLBACK');
  throw error;
 }
 const organizationId = localDemoDescriptor.organizationId;
 const platform = createPlatformService(db);
 const crm = createCrmService(db);
 const pipeline = createPipelineService(db);
 const tasks = createTaskService(db);
 const sales = createSalesService(db);
 const timesheets = createTimesheetService(db);
 const invoices = createInvoiceService(db);
 const customer = await crm.create(ownerId, organizationId, {
  name: 'Northstar Home Services', email: 'hello@northstar.example', phone: '+92 300 000 1234',
  website: 'https://northstar.example.test', notes: 'Fictional customer for local walkthroughs.', ownerId
 });
 await crm.addContact(ownerId, organizationId, customer.id, { name: 'Samira Demo', email: 'samira@northstar.example', jobTitle: 'Operations lead' });
 await crm.addActivity(ownerId, organizationId, customer.id, { type: 'MEETING', body: 'Fictional discovery call: map enquiry intake, appointment scheduling and follow-up.' });
 let deal = await pipeline.createDeal(ownerId, organizationId, {
  customerId: customer.id, name: 'Northstar service portal', ownerId, amountMinor: '8500000', currency: 'PKR',
  expectedCloseOn: '2026-11-15', notes: 'Fictional fixed-scope service portal proposal; no payment provider is connected.'
 });
 deal = await pipeline.updateDeal(ownerId, organizationId, deal.id, { version: deal.version, stage: 'WON' });
 const projectResult = await pipeline.createProject(ownerId, organizationId, deal.id, {
  version: deal.version, name: 'Customer service portal', managerId: reviewer.id, deadline: '2026-11-30'
 });
 const project = projectResult.project;
 const task = await tasks.create(ownerId, organizationId, {
  projectId: project.id, title: 'Map the customer intake journey',
  description: 'Review enquiry, scheduling and follow-up steps for the service portal.',
  assigneeId: reviewer.id, deadline: '2026-11-20', estimatedHours: 12
 });
 const timeEntry = await timesheets.create(reviewer.id, organizationId, {
  requestId: 'local-demo-time-entry-001', projectId: project.id, taskId: task.id,
  workDate: new Date().toISOString().slice(0, 10), minutes: 90, billable: true,
  description: 'Fictional discovery and service journey mapping.'
 });
 const submitted = await timesheets.submit(reviewer.id, organizationId, timeEntry.entry.id, { version: timeEntry.entry.version });
 await timesheets.review(ownerId, organizationId, timeEntry.entry.id, { version: submitted.version, decision: 'APPROVE', note: 'Approved fictional demo time.' });
 let quote = await sales.create(ownerId, organizationId, {
  customerId: customer.id, dealId: deal.id, title: 'Northstar portal implementation', currency: 'PKR',
  terms: 'Fictional demo quote. No payment or external billing provider is connected.', validUntil: '2026-12-31',
  items: [{ description: 'Service portal implementation', quantity: 1, unitMinor: '8500000', taxRateBps: 0 }]
 });
 quote = await sales.issue(ownerId, organizationId, quote.id, { version: quote.version });
 quote = await sales.decide(ownerId, organizationId, quote.id, { version: quote.version, approvalReference: 'FICTIONAL-DEMO-ACCEPTANCE' }, true);
 const order = await sales.convert(ownerId, organizationId, quote.id, { version: quote.version });
 let invoice = await invoices.create(ownerId, organizationId, { salesOrderId: order.order.id });
 invoice = await invoices.issue(ownerId, organizationId, invoice.invoice.id, { version: invoice.invoice.version });
 return { organizationId, ownerEmail: localDemoDescriptor.email, reviewerEmail: reviewer.email, projectId: project.id, taskId: task.id, invoiceId: invoice.id };
}
