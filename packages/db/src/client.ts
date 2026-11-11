import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return drizzlePg(pool, { schema, casing: 'snake_case' });
}

/** Any Drizzle Postgres database with our schema (node-postgres in prod, PGlite in tests). */
export type Db = ReturnType<typeof createDb>;
