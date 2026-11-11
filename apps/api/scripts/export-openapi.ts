// Writes the OpenAPI document to packages/api-client so the app gets typed API calls.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createTestDb } from '@krug/db/testing';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const { db, close } = await createTestDb();
const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test' }) });
const res = await app.request('/openapi.json');
const out = fileURLToPath(new URL('../../../packages/api-client/openapi.json', import.meta.url));
await writeFile(out, JSON.stringify(await res.json(), null, 2) + '\n');
await close();
console.log(`wrote ${out}`);
