// Local acceptance fixture only. No provider request; output is explicitly a fixture.
import {readFileSync} from 'node:fs';
import {openDatabase} from '../backend/src/db/database.js';
import {seedUsers} from '../backend/src/db/seed.js';
import {createApp} from '../backend/src/app.js';
const db=openDatabase(':memory:');seedUsers(db);
const fixture=JSON.parse(readFileSync(new URL('../backend/test/fixtures/expected.json',import.meta.url)));
const app=createApp({db,extract:async()=>structuredClone(fixture),sessionSecret:'fixture-only-secret-at-least-thirty-two-characters',frontendOrigin:'http://127.0.0.1:3020',production:false});
app.listen(3020,'127.0.0.1',()=>console.log('Fixture AI verification server http://127.0.0.1:3020 (no live provider)'));
