import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { migratePlatform } from '../src/platform/migrations.js';
import { createApp } from '../src/app.js';
import {
 assertLocalDemoDatabase, isLoopbackSocket, localDemoDescriptor, seedLocalDemo,
 validateLocalDemoActivation
} from '../src/localDemo.js';

const sessionSecret = 'local-demo-test-session-secret-which-is-long-enough';
async function fixture() {
 const directory = mkdtempSync(join(tmpdir(), 'novaworks-local-demo-'));
 const path = join(directory, 'demo.sqlite');
 const db = openDatabase(path);
 await migratePlatform(db);
 await seedLocalDemo(db);
 return { directory, path, db };
}
function activate(db, overrides = {}) {
 return validateLocalDemoActivation({ localDemo: localDemoDescriptor, db, production: false, erpEnabled: true, enabled: true, ...overrides });
}
async function listen(app) {
 const server = app.listen(0, '127.0.0.1');
 await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
 return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test('local demo activation requires fixed credentials, explicit ERP configuration, nonproduction and marked SQLite', async () => {
 const { directory, db } = await fixture();
 try {
  assert.equal(activate(db), true);
  assert.throws(() => validateLocalDemoActivation({ localDemo: { ...localDemoDescriptor, password: 'attacker-chosen-password' }, db, production: false, erpEnabled: true, enabled: true }), /fixed fictional fixture/);
  assert.throws(() => activate(db, { production: true }), /production/);
  assert.throws(() => activate(db, { enabled: false }), /explicit LOCAL_DEMO_ENABLED/);
  assert.throws(() => activate(db, { erpEnabled: false }), /ERP mode/);
  assert.throws(() => activate({ kind: 'postgres' }), /SQLite/);
  const unmarked = openDatabase(join(directory, 'unmarked.sqlite'));
  try { assert.throws(() => activate(unmarked), /marked isolated fixture/); }
  finally { unmarked.close(); }
  assert.equal(isLoopbackSocket('127.0.0.1'), true);
  assert.equal(isLoopbackSocket('::1'), true);
  assert.equal(isLoopbackSocket('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackSocket('10.0.0.2'), false);
  assertLocalDemoDatabase(db);
 } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('fictional owner logs in, selects only the fixture company, and saved project data survives reopen', async () => {
 const { directory, path, db } = await fixture();
 const prior = { NODE_ENV: process.env.NODE_ENV, LOCAL_DEMO_ENABLED: process.env.LOCAL_DEMO_ENABLED, TRUST_PROXY: process.env.TRUST_PROXY };
 process.env.NODE_ENV = 'test';
 process.env.LOCAL_DEMO_ENABLED = '1';
 process.env.TRUST_PROXY = '1';
 let server;
 try {
  const app = createApp({ db, localDemo: localDemoDescriptor, sessionSecret, production: false, erpEnabled: true });
  ({ server } = await listen(app));
  const base = `http://127.0.0.1:${server.address().port}`;
  const capabilities = await fetch(`${base}/api/capabilities`, { headers: { 'X-Forwarded-For': '203.0.113.9' } }).then(response => response.json());
  assert.deepEqual(capabilities.localDemo, localDemoDescriptor);

  const loginResponse = await fetch(`${base}/api/auth/login`, {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ email: localDemoDescriptor.email, password: localDemoDescriptor.password })
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie').split(';')[0];
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', Cookie: cookie };
  const selection = await fetch(`${base}/api/v1/organizations/select`, { method: 'POST', headers, body: JSON.stringify({ organizationId: localDemoDescriptor.organizationId }) });
  assert.equal(selection.status, 200);
  const projects = await fetch(`${base}/api/v1/projects`, { headers }).then(response => response.json());
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'Customer service portal');
  const taskList = await fetch(`${base}/api/v1/tasks`, { headers }).then(response => response.json());
  assert.equal(taskList.tasks.length, 1);
  const taskId = taskList.tasks[0].id;
  const changedTask = await fetch(`${base}/api/v1/tasks/${taskId}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'IN_PROGRESS', version: taskList.tasks[0].version }) });
  assert.equal(changedTask.status, 200);
  const denied = await fetch(`${base}/api/v1/organizations/select`, { method: 'POST', headers, body: JSON.stringify({ organizationId: 'another-company' }) });
  assert.equal(denied.status, 403);

  const created = await fetch(`${base}/api/v1/projects`, { method: 'POST', headers, body: JSON.stringify({ name: 'Saved walkthrough project', clientName: 'Northstar Home Services', description: 'A persisted local edit.', managerId: '10000000-0000-4000-8000-000000000002', deadline: '2026-12-10' }) });
  assert.equal(created.status, 201);
  const saved = await created.json();
  await new Promise(resolve => server.close(resolve));
  server = null;
  db.close();
  const reopened = openDatabase(path);
  try {
   assertLocalDemoDatabase(reopened);
   const row = reopened.prepare('SELECT name FROM platform_projects WHERE organization_id=? AND id=?').get(localDemoDescriptor.organizationId, saved.id);
   assert.equal(row.name, 'Saved walkthrough project');
   assert.equal(reopened.prepare('SELECT status FROM platform_tasks WHERE organization_id=? AND id=?').get(localDemoDescriptor.organizationId, taskId).status, 'IN_PROGRESS');
   assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM platform_customers WHERE organization_id=?').get(localDemoDescriptor.organizationId).count, 1);
   assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM platform_deals WHERE organization_id=?').get(localDemoDescriptor.organizationId).count, 1);
   assert.equal(reopened.prepare("SELECT stage_code FROM platform_deals WHERE organization_id=?").get(localDemoDescriptor.organizationId).stage_code, 'WON');
   assert.equal(reopened.prepare("SELECT status FROM platform_time_entries WHERE organization_id=?").get(localDemoDescriptor.organizationId).status, 'APPROVED');
   assert.equal(reopened.prepare("SELECT status FROM platform_client_invoices WHERE organization_id=?").get(localDemoDescriptor.organizationId).status, 'ISSUED');
   assert.equal(reopened.prepare("SELECT status FROM platform_quotes WHERE organization_id=?").get(localDemoDescriptor.organizationId).status, 'ACCEPTED');
   assert.equal(reopened.prepare("SELECT COUNT(*) AS count FROM platform_sales_orders WHERE organization_id=?").get(localDemoDescriptor.organizationId).count, 1);
  } finally { reopened.close(); }
 } finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db.isOpen) db.close();
  for (const key of Object.keys(prior)) if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key];
  rmSync(directory, { recursive: true, force: true });
 }
});

test('fixture seed rejects unknown and already initialized databases without replacing data', async () => {
 const { directory, db } = await fixture();
 try {
  await assert.rejects(seedLocalDemo(db), /existing or partially initialized/);
  assert.equal(db.prepare('SELECT name FROM platform_projects WHERE name=?').get('Customer service portal').name, 'Customer service portal');
  const unknown = openDatabase(join(directory, 'unknown.sqlite'));
  try { assert.throws(() => assertLocalDemoDatabase(unknown), /no such table|marked isolated/); }
  finally { unknown.close(); }
 } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
