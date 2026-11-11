import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().optional(),
  APP_URL: z.url().default('http://localhost:8081'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  DEV_AUTH: z.enum(['0', '1']).default('0'),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string | undefined;
  appUrl: string;
  corsOrigins: string[];
  /** Temporary header-based auth for local development and tests (replaced by Better Auth in step 0.7). */
  devAuth: boolean;
}

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const e = Env.parse(source);
  if (e.NODE_ENV === 'production' && e.DEV_AUTH === '1') {
    throw new Error('DEV_AUTH must never be enabled in production');
  }
  if (e.NODE_ENV === 'production' && !e.DATABASE_URL)
    throw new Error('DATABASE_URL is required in production');
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL || undefined,
    appUrl: e.APP_URL.replace(/\/$/, ''),
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    devAuth: e.DEV_AUTH === '1',
  };
}
