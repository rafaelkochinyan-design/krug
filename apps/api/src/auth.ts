import { createMiddleware } from 'hono/factory';
import { and, eq, isNull } from 'drizzle-orm';
import { users } from '@krug/db';
import { ApiError } from './errors';
import type { AppEnv } from './context';

/**
 * Resolves the current user.
 * TEMPORARY (until step 0.7): when `devAuth` is on, the `x-dev-user-id` header names the user.
 * In production `devAuth` cannot be enabled (see config.ts), so this resolves nobody until
 * Better Auth sessions replace it.
 */
export const resolveUser = createMiddleware<AppEnv>(async (c, next) => {
  const config = c.get('config');
  const header = c.req.header('x-dev-user-id');
  if (config.devAuth && header) {
    const [u] = await c
      .get('db')
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, header), isNull(users.deletedAt)));
    c.set('userId', u?.id);
  } else {
    c.set('userId', undefined);
  }
  await next();
});

export function requireUser(c: { get(key: 'userId'): string | undefined }): string {
  const id = c.get('userId');
  if (!id) throw new ApiError(401, 'unauthorized', 'Sign in required');
  return id;
}

/** Route guard: answers 401 before input validation, so anonymous callers learn nothing about the API's rules. */
export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  requireUser(c);
  await next();
});
