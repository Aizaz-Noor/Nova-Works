import session from 'express-session';

const DEFAULT_TTL = 8 * 60 * 60 * 1000;

// Use the application's SQLite connection so authenticated sessions survive restart.
export class SQLiteSessionStore extends session.Store {
 constructor(db) {
  super();
  this.db = db;
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
   sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL
  ); CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
 }
 expiry(value) {
  const expires = value.cookie?.expires;
  if (expires) {
   const timestamp = new Date(expires).getTime();
   if (Number.isFinite(timestamp)) return timestamp;
  }
  const maxAge = value.cookie?.maxAge;
  return Date.now() + (Number.isFinite(maxAge) && maxAge >= 0 ? maxAge : DEFAULT_TTL);
 }
 cleanup() {
  this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
 }
 get(sid, callback) {
  let result;
  try {
   this.cleanup();
   const row = this.db.prepare('SELECT data FROM sessions WHERE sid = ?').get(sid);
   result = row ? JSON.parse(row.data) : null;
  } catch (error) { callback(error); return; }
  callback(null, result);
 }
 set(sid, value, callback = () => {}) {
  try {
   this.cleanup();
   this.db.prepare(`INSERT INTO sessions(sid, data, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`)
    .run(sid, JSON.stringify(value), this.expiry(value));
  } catch (error) { callback(error); return; }
  callback(null);
 }
 destroy(sid, callback = () => {}) {
  try { this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); }
  catch (error) { callback(error); return; }
  callback(null);
 }
 touch(sid, value, callback = () => {}) {
  try {
   this.db.prepare('UPDATE sessions SET data = ?, expires_at = ? WHERE sid = ?')
    .run(JSON.stringify(value), this.expiry(value), sid);
  } catch (error) { callback(error); return; }
  callback(null);
 }
}
