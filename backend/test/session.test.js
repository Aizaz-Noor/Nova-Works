import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { SQLiteSessionStore } from '../src/services/sessionStore.js';

const call = (store, method, ...args) => new Promise((resolve, reject) => {
 store[method](...args, (error, value) => error ? reject(error) : resolve(value));
});

test('authenticated session persists across closing and reopening SQLite', async () => {
 const directory = mkdtempSync(join(tmpdir(), 'novaworks-session-'));
 const path = join(directory, 'sessions.sqlite');
 let db;
 try {
  db = openDatabase(path);
  let store = new SQLiteSessionStore(db);
  await call(store, 'set', 'persistent-session', { userId: 'ADMIN', cookie: { maxAge: 28_800_000 } });
  db.close();
  db = openDatabase(path);
  store = new SQLiteSessionStore(db);
  assert.equal((await call(store, 'get', 'persistent-session')).userId, 'ADMIN');
  await call(store, 'destroy', 'persistent-session');
  assert.equal(await call(store, 'get', 'persistent-session'), null);
 } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('expired sessions are rejected and touch extends valid sessions only', async () => {
 const db = openDatabase(':memory:');
 try {
  const store = new SQLiteSessionStore(db);
  await call(store, 'set', 'expired', { userId: 'ADMIN', cookie: { expires: new Date(Date.now() - 1000) } });
  assert.equal(await call(store, 'get', 'expired'), null);
  await call(store, 'set', 'active', { userId: 'DEV01', cookie: { maxAge: 1000 } });
  const before = db.prepare('SELECT expires_at FROM sessions WHERE sid = ?').get('active').expires_at;
  await call(store, 'touch', 'active', { userId: 'DEV01', cookie: { maxAge: 10_000 } });
  assert.ok(db.prepare('SELECT expires_at FROM sessions WHERE sid = ?').get('active').expires_at > before);
  await call(store, 'touch', 'missing', { cookie: { maxAge: 1000 } });
  assert.equal(await call(store, 'get', 'missing'), null);
 } finally { db.close(); }
});

test('store reports database errors through callbacks', async () => {
 const db = openDatabase(':memory:');
 const store = new SQLiteSessionStore(db);
 db.close();
 await assert.rejects(call(store, 'get', 'anything'));
 await assert.rejects(call(store, 'set', 'anything', {}));
 await assert.rejects(call(store, 'destroy', 'anything'));
 await assert.rejects(call(store, 'touch', 'anything', {}));
});
