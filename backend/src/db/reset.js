import { openDatabase, transaction } from './database.js';
const db = openDatabase();
transaction(db, () => db.exec('DELETE FROM tasks; DELETE FROM projects; DELETE FROM transcript_submissions;'));
db.close();
console.log('Generated projects, tasks and transcript deduplication records cleared; users retained.');
