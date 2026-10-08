import { openConfiguredDatabase } from '../backend/src/db/database.js';
import { createApp } from '../backend/src/app.js';
let ready;
function fail(code) { const error = new Error('Hosted service configuration unavailable'); error.code = code; throw error; }
async function initialize() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL_MISSING');
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || process.env.SESSION_SECRET.startsWith('replace-')) fail('SESSION_SECRET_INVALID');
  if (!process.env.FRONTEND_ORIGIN) fail('FRONTEND_ORIGIN_MISSING');
  try { if (new URL(process.env.FRONTEND_ORIGIN).origin !== process.env.FRONTEND_ORIGIN) fail('FRONTEND_ORIGIN_INVALID'); }
  catch { fail('FRONTEND_ORIGIN_INVALID'); }
  process.env.DATABASE_AUTO_MIGRATE = '0';
  // This adapter runs behind Vercel's HTTPS ingress, not a public HTTP listener.
  process.env.TRUST_PROXY = '1';
  if (process.env.VERCEL) delete process.env.DATABASE_CA_FILE;
  // Hosted certificate text takes precedence over a stale local-only file path.
  if (process.env.DATABASE_CA_CERT) {
    process.env.DATABASE_CA_CERT = process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n').trim();
    delete process.env.DATABASE_CA_FILE;
  }
  const db = await openConfiguredDatabase();
  try { return createApp({ db, production: true }); }
  catch (error) { await db.close(); throw error; }
}
const safeCodes = new Set(['DATABASE_URL_MISSING','SESSION_SECRET_INVALID','FRONTEND_ORIGIN_MISSING','FRONTEND_ORIGIN_INVALID','28P01','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','ENOTFOUND','ECONNREFUSED','ETIMEDOUT','DATABASE_INIT_FAILED']);
export default async function handler(req, res) {
  try {
    ready ||= initialize().catch(error => { ready = undefined; throw error; });
    const app = await ready;
    app(req, res);
  } catch (error) {
    const diagnostic = safeCodes.has(error.code) ? error.code : 'STARTUP_FAILED';
    console.error('NovaWorks startup diagnostic:', diagnostic);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: `Service configuration or database connection is unavailable (${diagnostic})` } }));
  }
}
