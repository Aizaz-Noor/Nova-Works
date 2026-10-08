// Isolated recording server: real app and provider, fictional users, separate SQLite file.
// This never opens DATABASE_URL or changes the deployed workspace.
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../backend/src/db/database.js';
import { seedUsers } from '../backend/src/db/seed.js';
import { createApp } from '../backend/src/app.js';
const port = Number(process.env.DEMO_PORT || 3008);
const path = resolve(process.argv[2] || 'tmp/public-demo.sqlite');
const db = openDatabase(path);
await seedUsers(db);
const app = createApp({ db, production: false, sessionSecret: randomBytes(32).toString('hex'), frontendOrigin: `http://127.0.0.1:${port}` });
const server = app.listen(port, '127.0.0.1', () => console.log(`Isolated demo ready: http://127.0.0.1:${port}`));
let stopping = false;
function stop() { if(stopping)return; stopping=true; server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGINT',stop);process.on('SIGTERM',stop);