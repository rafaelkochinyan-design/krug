import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from '@hono/zod-openapi';

export type ErrorCode =
  'validation_error' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'internal_error';

/** Every error the API returns has this shape, so clients handle errors in one place. */
export const ErrorBody = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'not_found' }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('Error');

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, 'not_found', `${what} not found`);
export const forbidden = (message = 'Not allowed') => new ApiError(403, 'forbidden', message);

export function errorResponse(c: Context, err: Error) {
  if (err instanceof ApiError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status,
    );
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'internal_error', message: err.message } }, err.status);
  }
  // Never leak internals to clients; the full error goes to the log (and to Sentry once configured).
  console.error(
    JSON.stringify({
      level: 'error',
      msg: err.message,
      stack: err.stack,
      requestId: c.get('requestId'),
    }),
  );
  return c.json({ error: { code: 'internal_error', message: 'Internal error' } }, 500);
}
