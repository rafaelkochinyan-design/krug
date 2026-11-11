# Architecture

One TypeScript monorepo (ADR 0001). Shared packages are consumed as TypeScript source. The main goal of this
architecture: the web app of today becomes the iOS/Android apps of phase 2 without a rewrite. See
`.claude/rules/mobile.md`.

## Layers and dependency direction

```
apps/app (Expo)  ──►  packages/api-client  ──(HTTP /v1)──►  apps/api (Hono)
     │                                                          │
     ├──►  packages/domain  ◄──────────────────────────────────┤
     └──►  packages/i18n                                        └──►  packages/db (Drizzle)
```

- `packages/domain`: pure business rules (schedule, membership placement, invite codes, limits, access policy).
  It depends on nothing in the repo; `luxon` is its only runtime dependency. **No I/O.** Both the API and the app
  call it, and neither re-implements it.
  - `policy.ts`: access-control functions (`canJoin`, `canLeave`, `canViewCircle`, etc.) and field-visibility
    projections (`toCircleMember`, `firstName`, etc.). Every authorization decision in the API calls these;
    never inline.
- `packages/db`: Drizzle schema, committed SQL migrations, and `createTestDb()` (PGlite) in `@krug/db/testing`.
  Only the API imports it.
- `packages/i18n`: hy / ru / en messages typed against English, plus `searchKey()` transliteration.
- `packages/api-client`: generated from the API's OpenAPI document. **Never hand-edit
  `src/generated/schema.ts` or `openapi.json`.** Run `pnpm --filter @krug/api-client generate`.
- `apps/api`: HTTP only. Route → service → db. Business decisions are delegated to domain.
- `apps/app`: screens in `src/app` (Expo Router; every file is a route); everything else in `src/ui` (tokens and
  components) and `src/lib` (API client, i18n, storage, formatting: the platform seams).

The app never imports `@krug/db` or anything from `apps/api`. The API never imports from `apps/app`. Domain never
imports db, Hono, React or Node APIs.

## API module shape (`apps/api/src/modules/<area>/`)

- `schemas.ts`: zod schemas with `.openapi('Name')`. Request bodies, params and response shapes. Limits are
  imported from `@krug/domain`, never retyped.
- `routes.ts`: an `OpenAPIHono<AppEnv>` router. Every route is declared with `createRoute` (method, path under
  `/v1`, tags, summary, `security`, request, responses including the shared `errors` map). Auth guards are
  applied with `router.use(path, authRequired)` **before** the `.openapi()` handlers, so 401 comes before
  validation.
- `service.ts`: plain async functions `(db, …args) => result`. They hold the DB logic and transactions, call
  domain for decisions, and throw `ApiError` / `notFound()` / `forbidden()`.
- Mounted in `apps/api/src/app.ts` with `app.route('/', <router>)`.

Canonical example: `apps/api/src/modules/circles/`.

## Request pipeline (`apps/api/src/app.ts`)

`requestId` → `secureHeaders` → `cors` → db/config injection + structured access log (no bodies, no query strings,
no personal data) → `resolveUser` → routers → `notFound` / `onError(errorResponse)`.

There is no DI container. Dependencies (`db`, `config`) are passed to `createApp({ db, config })` and read from
the context with `c.get('db')` / `c.get('config')`. Tests build the app the same way with a PGlite DB
(`apps/api/test/helpers.ts`).

## Response and error shape

- Success: the zod response schema of the route, plain JSON (no envelope). `204` with an empty body for
  actions.
- Errors, always: `{ error: { code, message, details? } }` (`ErrorBody` in `apps/api/src/errors.ts`).
  Codes: `validation_error | unauthorized | forbidden | not_found | conflict | internal_error`.
  Validation failures have `details: [{ path, message }]`, which the app maps to field errors
  (`RequestError.fieldErrors()`).
- Outsiders asking for a circle get `404`, not `403`, so IDs reveal nothing.
- Unknown errors: logged with `requestId`, returned as `500 internal_error` with no internals.

## Configuration

`apps/api/src/config.ts` parses env with zod (`NODE_ENV`, `PORT`, `DATABASE_URL`, `APP_URL`, `CORS_ORIGINS`,
`DEV_AUTH`). New settings go there, typed, with a safe default and, if dangerous, a production guard. Names are
documented in `.env.example`; values never go in the repo.

App env: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DEV_AUTH` (public by definition, never secrets).

## Time and dates

- Store instants as `timestamptz`. Store a circle's wall-clock settings (`weekday`, `startTime` `HH:mm`,
  `timeZone`) separately.
- Schedules come from `generateSchedule()` in domain. It keeps the same local time across DST.
- The API returns UTC ISO strings. The app formats them with `Intl` in the circle's `timeZone`
  (`src/lib/format.ts`).
