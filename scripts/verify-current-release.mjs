import {createHash} from 'node:crypto';
import {readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const candidate = 'https://nova-works-cpmr05b2o-aizaz-noors-projects.vercel.app';
const publicBase = 'https://nova-works-zeta.vercel.app';
const args = process.argv.slice(2);
const base = args[0];
const manifestArg = args.find(arg => arg.startsWith('--manifest='));
if ((args.length < 1 || args.length > 2) || ![candidate, publicBase].includes(base) || args.some(arg => arg !== base && !arg.startsWith('--manifest='))) {
  console.error('Usage: node NovaWorks/scripts/verify-current-release.mjs <approved-deployment-url> [--manifest=path]');
  process.exit(2);
}

const isProtected = base === candidate;
const origin = publicBase;
const state = JSON.parse(await readFile('tmp/release-private/hosted-demo-state.json', 'utf8'));
if (state.result !== 'PASS' || !state.organizationId || !state.ownerEmail || !state.managerEmail) {
  throw new Error('Approved fictional release fixture is incomplete.');
}
const manifestPath = manifestArg ? manifestArg.slice('--manifest='.length) : 'tmp/release-private/release-manifest.json';
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.result !== 'PASS' || !Array.isArray(manifest.files)) throw new Error('Source release manifest is invalid.');
const evidenceDir = await import('node:fs/promises').then(({mkdtemp}) => mkdtemp(resolve('tmp/release-private/current-release-')));
const cookieJar = join(evidenceDir, 'session.cookies');
const checks = [];
const failures = [];
let cookie = '';
let sequence = 0;

function check(name, ok, detail = {}) {
  checks.push({name, status: ok ? 'PASS' : 'FAIL', ...detail});
  if (!ok) failures.push(name);
}

function findRecord(value, id) {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray(value) && value.id === id) return value;
  for (const child of Object.values(value)) {
    const found = findRecord(child, id);
    if (found) return found;
  }
  return null;
}

async function request(path, method = 'GET', body, expected = 200, company = true, companyHeader = state.organizationId) {
  const headers = {Origin: origin};
  if (company) headers['X-NovaWorks-Organization'] = companyHeader;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  if (isProtected) {
    const bodyFile = body === undefined ? null : JSON.stringify(body);
    const outFile = join(evidenceDir, `response-${++sequence}.bin`);
    const headersFile = join(evidenceDir, `headers-${sequence}.txt`);
    const cli = resolve('tmp/release-tools/node_modules/vercel/dist/vc.js');
    const cliArgs = [cli, '--scope', 'aizaz-noors-projects', 'curl', base + path, '--', '--silent', '--show-error', '-X', method,
      '-b', cookieJar, '-c', cookieJar, '-H', `Origin: ${origin}`];
    if (company) cliArgs.push('-H', `X-NovaWorks-Organization: ${companyHeader}`);
    if (body !== undefined) cliArgs.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
    cliArgs.push('-D', headersFile, '-o', outFile, '-w', '%{http_code}');
    try {
      const result = spawnSync(process.execPath, cliArgs, {encoding: 'utf8', timeout: 90000, input: bodyFile});
      if (result.error || result.status !== 0) throw new Error('Protected deployment request transport failed.');
      const status = Number(result.stdout.trim().slice(-3));
      const bytes = await readFile(outFile);
      const rawHeaders = await readFile(headersFile, 'utf8');
      if (path === '/api/auth/login' && method === 'POST') {
        const setCookie = rawHeaders.split(/\r?\n/).find(line => /^set-cookie:\s*novaworks\.sid=/i.test(line)) ?? '';
        check('session cookie flags', /HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie) && /SameSite=Lax/i.test(setCookie));
      }
      response = {status, headers: new Map(), bytes};
    } finally {
      await rm(headersFile, {force: true});
      await rm(outFile, {force: true});
    }
  } else {
    const raw = await fetch(base + path, {method, redirect: 'error', headers: {...headers, ...(cookie ? {Cookie: cookie} : {})},
      ...(body !== undefined ? {body: JSON.stringify(body)} : {})});
    if (path === '/api/auth/login' && method === 'POST') {
      for (const value of raw.headers.getSetCookie()) {
        if (!value.startsWith('novaworks.sid=')) continue;
        check('session cookie flags', /HttpOnly/i.test(value) && /Secure/i.test(value) && /SameSite=Lax/i.test(value));
        cookie = value.split(';')[0];
      }
    }
    response = {status: raw.status, headers: raw.headers, bytes: Buffer.from(await raw.arrayBuffer())};
  }
  check(`${method} ${path}`, response.status === expected, {httpStatus: response.status});
  return {...response, json() { return JSON.parse(response.bytes.toString('utf8')); }};
}

async function getJson(path, expected = 200) {
  const response = await request(path, 'GET', undefined, expected);
  return expected === 200 ? response.json() : null;
}

async function login(email) {
  const password = process.env.NOVAWORKS_DEMO_PASSWORD;
  if (!password) throw new Error('Set NOVAWORKS_DEMO_PASSWORD to the current public demo password.');
  return request('/api/auth/login', 'POST', {email, password}, 200, false);
}

async function logout() {
  await request('/api/auth/logout', 'POST', {}, 200, false);
  cookie = '';
}

try {
  const htmlResponse = await request('/', 'GET', undefined, 200, false);
  const html = htmlResponse.bytes.toString('utf8');
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"?#]+\.(?:js|css))(?:\?[^\"]*)?"/g)].map(match => match[1]))];
  const localHtml = await readFile('app/client/dist/index.html', 'utf8');
  const expectedAssets = [...new Set([...localHtml.matchAll(/(?:src|href)="([^"]*\/assets\/[^"?#]+\.(?:js|css))(?:\?[^\"]*)?"/g)].map(match => match[1]))];
  check('deployment HTML asset paths match current build', assets.length > 0 && expectedAssets.length > 0
    && assets.length === expectedAssets.length && expectedAssets.every(asset => assets.includes(asset)), {assetCount: assets.length});
  const expectedAssetDigests = {};
  for (const asset of expectedAssets) {
    const localPath = resolve('app/client/dist', asset.replace(/^\//, ''));
    expectedAssetDigests[asset] = createHash('sha256').update(await readFile(localPath)).digest('hex');
  }
  const assetDigests = {};
  for (const asset of assets) {
    const response = await request(asset, 'GET', undefined, 200, false);
    assetDigests[asset] = createHash('sha256').update(response.bytes).digest('hex');
  }
  for (const [asset, expectedHash] of Object.entries(expectedAssetDigests)) {
    check(`deployment asset hash ${asset}`, assetDigests[asset] === expectedHash);
  }
  const caps = await getJson('/api/capabilities');
  check('ERP capability enabled', caps.erpEnabled === true);

  await login(state.ownerEmail);
  const organizations = await getJson('/api/v1/organizations', 200);
  check('owner organization listed', JSON.stringify(organizations).includes(state.organizationId));
  const selected = await request('/api/v1/organizations/select', 'POST', {organizationId: state.organizationId}, 200);
  const selectedJson = selected.json();
  check('organization context selected', selectedJson.organizationId === state.organizationId);
  const context = await getJson('/api/v1/context');
  check('organization context retained on reads', context.organizationId === state.organizationId);

  const records = {
    customers: state.customerId, projects: state.projectId, tasks: state.taskId, deals: state.dealId,
    quotes: state.quoteId, 'sales-orders': state.orderId, 'client-invoices': state.invoiceId,
  };
  const paths = ['customers', 'projects', 'tasks', 'deals', 'quotes', 'sales-orders', 'time-entries',
    'client-invoices', 'reports/sales', 'reports/delivery', 'reports/financial', 'settings', 'notifications', 'billing-rates'];
  const payloads = {};
  for (const path of paths) payloads[path] = await getJson('/api/v1/' + path);
  for (const [path, id] of Object.entries(records)) {
    const item = findRecord(payloads[path], id);
    check(`seeded ${path} record present`, Boolean(item));
    if (['projects', 'tasks'].includes(path)) check(`seeded ${path} positive version`, Boolean(item && Number.isInteger(item.version) && item.version > 0));
  }

  const invoice = await getJson(`/api/v1/client-invoices/${state.invoiceId}`);
  const pdf = await request(`/api/v1/client-invoices/${state.invoiceId}/pdf`);
  check('invoice PDF signature', pdf.bytes.subarray(0, 5).toString() === '%PDF-');
  const finance = payloads['reports/financial'];
  const currency = finance.currencies?.find(entry => entry.currency === invoice.currency);
  check('financial report includes current invoice currency', Boolean(currency));
  if (currency && invoice.status === 'ISSUED') {
    const issued = BigInt(currency.issued_minor);
    const credits = BigInt(currency.credited_minor);
    const paid = BigInt(currency.paid_minor);
    const outstanding = BigInt(currency.outstanding_minor);
    check('financial balances reconcile algebraically', issued - credits - paid === outstanding);
    check('current invoice contributes to issued total', issued >= BigInt(invoice.total_minor));
    check('financial report includes current invoice ledger state', credits >= BigInt(invoice.creditedMinor)
      && paid >= BigInt(invoice.paidMinor) && outstanding >= BigInt(invoice.balanceMinor));
  }

  await request('/api/v1/projects', 'GET', undefined, 409, true, 'novaworks-legacy-demo');
  await request('/api/v1/organizations/select', 'POST', {organizationId: 'novaworks-legacy-demo'}, 403, true);
  await logout();
  await request('/api/v1/projects', 'GET', undefined, 401, true);

  await login(state.managerEmail);
  await request('/api/v1/organizations/select', 'POST', {organizationId: state.organizationId}, 200);
  const managerProjects = await getJson('/api/v1/projects');
  const managerTasks = await getJson('/api/v1/tasks');
  check('manager sees assigned project', JSON.stringify(managerProjects).includes(state.projectId));
  check('manager sees assigned task', JSON.stringify(managerTasks).includes(state.taskId));
  await request('/api/v1/reports/financial', 'GET', undefined, 403);
  await logout();

  const evidence = {result: failures.length ? 'FAIL' : 'PASS', base, transport: isProtected ? 'vercel-cli-curl; Origin pinned to public origin; not browser-origin proof' : 'native fetch', sourceManifest: {path: manifestPath, files: manifest.files, sha256: createHash('sha256').update(manifestBytes).digest('hex')}, checks, failures, expectedAssetDigests, assetDigests};
  const evidencePath = join(evidenceDir, 'results.json');
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({result: evidence.result, deployment: base, checks: checks.length, failures: failures.length, evidence: evidencePath}));
  if (failures.length) process.exitCode = 1;
} catch {
  const evidence = {result: 'FAIL', base, transport: isProtected ? 'vercel-cli-curl; Origin pinned to public origin; not browser-origin proof' : 'native fetch', sourceManifest: {path: manifestPath, files: manifest.files, sha256: createHash('sha256').update(manifestBytes).digest('hex')}, checks, failures: [...failures, 'request_or_fixture_error']};
  await writeFile(join(evidenceDir, 'results.json'), JSON.stringify(evidence, null, 2));
  console.error(JSON.stringify({result: 'FAIL', deployment: base, checks: checks.length, failures: evidence.failures.length, evidence: join(evidenceDir, 'results.json')}));
  process.exitCode = 1;
} finally {
  await rm(cookieJar, {force: true});
}
