# Krug

The same 6–8 people, one activity, one evening a week, for a whole season. Yerevan first; Armenian, Russian and English.

## Layout

```
apps/
  api/          Hono HTTP API (Node), OpenAPI at /openapi.json, docs at /docs
  app/          Expo app: web now, iOS and Android from the same code later
packages/
  domain/       Pure business rules (schedule, capacity, invite codes). No I/O.
  db/           Drizzle schema, migrations, test database (PGlite)
  i18n/         hy / ru / en messages, typed against English
  api-client/   Typed client generated from the API's OpenAPI document
docs/
  adr/          Architecture decisions and why
  qa/           How to test, checklists
```

## Requirements

Node 22.12+ and pnpm 10 (`corepack enable` picks the right pnpm from package.json).

## Run locally

```bash
pnpm install
pnpm --filter @krug/api dev          # API on http://localhost:8787, in-memory database, test users seeded
cp apps/app/.env.example apps/app/.env.local
pnpm --filter @krug/app dev          # then press w; web app on http://localhost:8081
```

Without `DATABASE_URL` the API uses an in-memory Postgres (PGlite): data disappears on restart. To use a real
database, set `DATABASE_URL` in `apps/api/.env` and run `pnpm --filter @krug/db db:migrate`.

## Checks

```bash
pnpm check          # typecheck + lint + tests, every package
pnpm format         # Prettier
```

CI runs the same checks on every pull request, plus the web build and a check that the generated API client
matches the API.

## Changing the API

1. Change schemas/routes in `apps/api/src/modules/**`, with tests.
2. `pnpm --filter @krug/api-client generate` — regenerates `openapi.json` and the typed client.
3. `pnpm check` — the app no longer compiles if it uses something that changed.

## Changing the database

1. Edit `packages/db/src/schema.ts`.
2. `pnpm --filter @krug/db db:generate` — writes a new SQL migration in `packages/db/drizzle/`. Review it; never edit
   an applied migration.
3. Migrations run before the new API version starts. Only additive changes in one release; removals come a release
   later (see docs/adr/0004).
