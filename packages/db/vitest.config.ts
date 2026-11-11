import { defineConfig } from 'vitest/config';

// Each test file boots an in-memory Postgres (PGlite) and applies migrations; under parallel CI load that can take
// several seconds, so the default 5 s limit would make tests flaky rather than catch real problems.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
