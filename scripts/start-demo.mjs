import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, 'backend');
const runtime = resolve(root, 'tmp', 'novaworks-local-demo');
const databasePath = resolve(runtime, 'demo.sqlite');
const markerPath = resolve(runtime, 'marker.json');
const secretPath = resolve(runtime, 'session-secret');
const marker = JSON.stringify({ kind: 'novaworks-local-demo', version: 1 });
const allowedRuntimeFiles = new Set(['demo.sqlite', 'demo.sqlite-shm', 'demo.sqlite-wal', 'marker.json', 'session-secret']);

function refuseHostedConfiguration() {
 const envFile = resolve(backend, '.env');
 const file = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
 const hosted = process.env.DATABASE_URL || process.env.REQUIRE_POSTGRES === '1' ||
  /^\s*DATABASE_URL\s*=\s*\S+/im.test(file) || /^\s*REQUIRE_POSTGRES\s*=\s*1\s*$/im.test(file);
 const production = process.env.NODE_ENV === 'production' || /^\s*NODE_ENV\s*=\s*production\s*$/im.test(file);
 if (hosted) throw new Error('A hosted database configuration is present; local demo startup was refused');
 if (production) throw new Error('Production mode is configured; local demo startup was refused');
}

function prepareRuntime() {
 if (existsSync(runtime) && lstatSync(runtime).isSymbolicLink()) throw new Error('Local demo runtime cannot be a symbolic link');
 if (existsSync(runtime) && !existsSync(markerPath)) {
  const files = readdirSync(runtime);
  if (files.length) throw new Error('Unmarked local demo runtime data exists; refusing to initialize over it');
 }
 mkdirSync(runtime, { recursive: true });
 for (const name of readdirSync(runtime)) if (!allowedRuntimeFiles.has(name)) throw new Error('Unexpected file in local demo runtime; refusing to continue');
 for (const name of readdirSync(runtime)) if (lstatSync(resolve(runtime, name)).isSymbolicLink()) throw new Error('Local demo runtime files cannot be symbolic links');
 const hasDb = existsSync(databasePath), hasMarker = existsSync(markerPath), hasSecret = existsSync(secretPath);
 if (hasDb !== hasMarker || hasMarker !== hasSecret) throw new Error('Local demo runtime is incomplete; refusing to repair it implicitly');
 if (hasMarker && readFileSync(markerPath, 'utf8') !== marker) throw new Error('Local demo marker is invalid');
 if (hasSecret && readFileSync(secretPath, 'utf8').length < 32) throw new Error('Local demo session key is invalid');
 if (!hasSecret) writeFileSync(secretPath, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' });
 return !hasDb;
}

async function refuseOccupiedPort() {
 await new Promise((resolveCheck, reject) => {
  const socket = createConnection({ host: '127.0.0.1', port: 3048 });
  socket.setTimeout(500);
  socket.once('connect', () => { socket.destroy(); reject(new Error('Port 3048 is already in use; local demo startup was refused')); });
  socket.once('timeout', () => { socket.destroy(); reject(new Error('Could not verify that port 3048 is free')); });
  socket.once('error', error => {
   if (error.code === 'ECONNREFUSED') resolveCheck();
   else reject(new Error('Could not verify that port 3048 is free'));
  });
 });
}

let db;
let server;
try {
 refuseHostedConfiguration();
 await refuseOccupiedPort();
 const fresh = prepareRuntime();
 process.env.NODE_ENV = 'development';
 process.env.LOCAL_DEMO_ENABLED = '1';
 process.env.ERP_ENABLED = '1';
 process.env.DATABASE_PATH = databasePath;
 process.env.DATABASE_URL = '';
 process.env.REQUIRE_POSTGRES = '0';
 process.env.PORT = '3048';
 process.env.HOST = '127.0.0.1';
 process.env.TRUST_PROXY = '0';
 process.env.SESSION_SECRET = readFileSync(secretPath, 'utf8');
 process.env.FRONTEND_ORIGIN = 'http://127.0.0.1:3048';
 process.env.BILLING_ENABLED = '0';
 process.env.BILLING_POLICY_FILE = '';
 process.env.PADDLE_API_KEY = '';
 process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET = '';
 process.env.TOKENROUTER_API_KEY = '';
 process.env.TOKENROUTER_BASE_URL = '';
 process.env.TOKENROUTER_MODEL = '';
 process.env.MFA_KEYRING_JSON = '';

 const [{ openConfiguredDatabase }, { migratePlatform }, fixture, { createApp }] = await Promise.all([
  import('../backend/src/db/database.js'),
  import('../backend/src/platform/migrations.js'),
  import('../backend/src/localDemo.js'),
  import('../backend/src/app.js')
 ]);
 db = await openConfiguredDatabase();
 await migratePlatform(db);
 if (fresh) {
  await fixture.seedLocalDemo(db);
  fixture.assertLocalDemoDatabase(db);
  writeFileSync(markerPath, marker, { flag: 'wx', mode: 0o600 });
 } else fixture.assertLocalDemoDatabase(db);
 const app = createApp({
  db, localDemo: fixture.localDemoDescriptor, frontendOrigin: 'http://127.0.0.1:3048',
  billingOptions: { enabled: false }, billingProvider: async () => { throw new Error('Billing provider is disabled for the local demo'); },
  paddleWebhookSecret: '', recoveryOptions: {}, companyAiFixture: false,
  companyAiOptions: { extract: async () => { throw new Error('Company AI extraction is disabled for the local demo'); } },
  extract: async () => { throw new Error('Transcript extraction is disabled for the local demo'); }
 });
 server = app.listen(3048, '127.0.0.1');
 await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
 console.log('NovaWorks local demo: http://127.0.0.1:3048');
 let stopping = false;
 const stop = () => {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await db?.close(); process.exit(0); });
 };
 process.on('SIGINT', stop);
 process.on('SIGTERM', stop);
} catch (error) {
 try { await db?.close(); } catch {}
 console.error(`Local demo startup refused: ${error.message}`);
 process.exitCode = 1;
}
