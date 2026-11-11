import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { createDb } from './client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = createDb(url);
await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
await db.$client.end();
console.log('migrations applied');
