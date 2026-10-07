import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { databasePath } from '../config.js';
import { schema } from './schema.js';
export function openDatabase(path = databasePath) {
 if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
 const db = new DatabaseSync(path);
 db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
 if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
 db.exec(schema);
 return db;
}
export function transaction(db, work) {
 db.exec('BEGIN IMMEDIATE');
 try { const result = work(); db.exec('COMMIT'); return result; }
 catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try{const db=await openConfiguredDatabase();await db.close();console.log('Database schema initialized.');}catch{console.error('Database initialization failed; check private configuration/connectivity');process.exitCode=1;}
}

export async function openConfiguredDatabase(){if(process.env.REQUIRE_POSTGRES==='1'&&!process.env.DATABASE_URL)throw new Error('PostgreSQL configuration is required');if(process.env.DATABASE_URL){const {openPostgres}=await import('./postgres.js');return openPostgres(process.env.DATABASE_URL);}return openDatabase();}
