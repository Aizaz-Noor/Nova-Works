import { openConfiguredDatabase } from '../backend/src/db/database.js';
import { createApp } from '../backend/src/app.js';
let ready;
async function initialize() {
  if (!process.env.DATABASE_URL) throw new Error('Hosted PostgreSQL is required');
  process.env.DATABASE_AUTO_MIGRATE = '0';
  const db = await openConfiguredDatabase();
  try { return createApp({ db }); }
  catch (error) { await db.close(); throw error; }
}
export default async function handler(req, res) {
  try {
    ready ||= initialize().catch(error => { ready = undefined; throw error; });
    const app = await ready;
    app(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service configuration or database connection is unavailable' } }));
  }
}
