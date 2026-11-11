import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { Db } from '@krug/db';
import { resolveUser } from './auth';
import type { Config } from './config';
import type { AppEnv } from './context';
import { errorResponse } from './errors';
import { circlesRouter } from './modules/circles/routes';
import { healthRouter } from './modules/health';

export function createApp(deps: { db: Db; config: Config }) {
  const app = new OpenAPIHono<AppEnv>({
    // Every validation failure gets the same error shape as everything else.
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: 'validation_error',
              message: 'Invalid input',
              details: result.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
              })),
            },
          },
          400,
        );
      }
    },
  });

  app.use('*', requestId());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: deps.config.corsOrigins,
      allowHeaders: ['content-type', 'x-dev-user-id'],
      credentials: true,
    }),
  );
  app.use('*', async (c, next) => {
    c.set('db', deps.db);
    c.set('config', deps.config);
    const started = performance.now();
    await next();
    if (deps.config.env !== 'test') {
      // Structured access log without personal data (no bodies, no query strings).
      console.log(
        JSON.stringify({
          level: 'info',
          requestId: c.get('requestId'),
          method: c.req.method,
          path: c.req.routePath,
          status: c.res.status,
          ms: Math.round(performance.now() - started),
        }),
      );
    }
  });
  app.use('*', resolveUser);

  app.route('/', healthRouter);
  app.route('/', circlesRouter);

  app.openAPIRegistry.registerComponent('securitySchemes', 'devUser', {
    type: 'apiKey',
    in: 'header',
    name: 'x-dev-user-id',
    description: 'TEMPORARY development auth, replaced by Better Auth sessions in step 0.7',
  });
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Krug API',
      version: '0.1.0',
      description: 'API for circles: one season of weekly meetings with the same people.',
    },
  });
  if (deps.config.env !== 'production') app.get('/docs', Scalar({ url: '/openapi.json' }));

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404));
  app.onError((err, c) => errorResponse(c, err));
  return app;
}

export type App = ReturnType<typeof createApp>;
