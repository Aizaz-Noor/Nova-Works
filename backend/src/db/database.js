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
 const db = openDatabase(); db.close(); console.log('SQLite schema initialized.');
}
