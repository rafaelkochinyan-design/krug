import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import type { AppEnv } from '../context';

const Health = z.object({ status: z.literal('ok'), db: z.enum(['ok', 'down']) }).openapi('Health');

export const healthRouter = new OpenAPIHono<AppEnv>().openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: 'Liveness and database check',
    responses: { 200: { content: { 'application/json': { schema: Health } }, description: 'Up' } },
  }),
  async (c) => {
    let db: 'ok' | 'down' = 'ok';
    try {
      await c.get('db').execute(sql`select 1`);
    } catch {
      db = 'down';
    }
    return c.json({ status: 'ok' as const, db }, 200);
  },
);
