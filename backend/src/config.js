import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(backendRoot, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
export const databasePath = process.env.DATABASE_PATH === ':memory:' ? ':memory:' : resolve(backendRoot, process.env.DATABASE_PATH || 'data/novaworks.sqlite');
