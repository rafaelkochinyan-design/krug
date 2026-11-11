import { serve } from '@hono/node-server';
import { createDb, type Db } from '@krug/db';
import { createApp } from './app';
import { loadConfig } from './config';
import { seedDevUsers } from './dev-seed';

const config = loadConfig();

async function database(): Promise<Db> {
  if (config.databaseUrl) return createDb(config.databaseUrl);
  // Local development without Postgres: in-memory PGlite with migrations (data is lost on restart).
  const { createTestDb } = await import('@krug/db/testing');
  console.warn('DATABASE_URL not set: using in-memory PGlite (development only)');
  return (await createTestDb()).db;
}

const db = await database();
if (config.devAuth) await seedDevUsers(db);
const app = createApp({ db, config });
const server = serve({ fetch: app.fetch, port: config.port }, (info) =>
  console.log(`API listening on http://localhost:${info.port} (docs: /docs)`),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
