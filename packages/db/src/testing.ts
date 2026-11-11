import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import type { Db } from './client';
import * as schema from './schema';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Fresh in-memory Postgres with all migrations applied. No server, no Docker. */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder });
  // Same query API as the node-postgres client; only the driver differs.
  return { db: db as unknown as Db, close: () => client.close() };
}
