import { users, type Db } from '@krug/db';
import { createTestDb } from '@krug/db/testing';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

export async function setup() {
  const { db, close } = await createTestDb();
  const config = loadConfig({ NODE_ENV: 'test', DEV_AUTH: '1', APP_URL: 'https://krug.test' });
  const app = createApp({ db, config });

  const call = async (method: string, path: string, opts: { as?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.as) headers['x-dev-user-id'] = opts.as;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { db, app, call, close, makeUser: (name: string) => makeUser(db, name) };
}

export async function makeUser(db: Db, name: string) {
  const [u] = await db.insert(users).values({ name }).returning();
  return u!.id;
}

export const validCircle = {
  title: 'Настолки по четвергам',
  activity: 'board games',
  language: 'ru',
  weekday: 4,
  startTime: '19:30',
  weeks: 8,
  capacity: 3,
  venueText: 'Cafe, Abovyan 12',
  startDate: '2026-11-10',
};
