# Codebase Snapshot

Generated: 2026-11-11 at commit (none: the folder was not yet a git repository). Refresh with `/snapshot` after
significant schema, route, service or pattern changes.

## Project Overview

Krug runs "circles": the same 6–8 people, one activity, one evening a week, for a season of 1–16 weeks. An
organizer creates a circle and shares an invite link. Others join until it is full; after that they go onto a
waitlist. Yerevan first; Armenian (default), Russian and English. 18+ only in v1. Members see each other's names
only.

The owner is a QA/product person, not a programmer; Claude writes the code. The web app comes first, and **the
same Expo code becomes the iOS and Android apps in phase 2**.

Roadmap markers that appear in code and docs:

- 0.3: hosting and PR previews
- 0.7: Better Auth replaces `DEV_AUTH`
- 1.x: notifications and Telegram
- 1.6: waitlist offer when a spot frees up

## Architecture

pnpm workspaces + Turborepo, TypeScript strict, internal packages consumed as source. See
`.claude/rules/architecture.md` and `docs/adr/0001–0005`.

- `packages/domain`: pure rules, no I/O (luxon only)
- `packages/db`: Drizzle schema, SQL migrations, PGlite test DB
- `packages/i18n`: hy/ru/en messages typed against English, `searchKey()` transliteration
- `packages/api-client`: OpenAPI document and a typed openapi-fetch client generated from the API
- `apps/api`: Hono + `@hono/zod-openapi`, routes under `/v1`, modules of the form schemas → routes → service
- `apps/app`: Expo SDK 58 + Expo Router. Exported as a static single-page web app today; EAS for native later.

Dependency direction:

- app → api-client / domain / i18n
- api → db / domain
- domain → nothing internal

## Key Files

- `apps/api/src/server.ts`: entry point. Loads config, creates the DB (Postgres if `DATABASE_URL` is set, otherwise
  in-memory PGlite), seeds dev users when `DEV_AUTH=1`, serves on `PORT` (8787), closes on SIGINT/SIGTERM.
- `apps/api/src/app.ts`: `createApp({ db, config })`. Middleware pipeline, routers, OpenAPI doc at
  `/openapi.json`, Scalar at `/docs` (not in production), JSON `notFound` / `onError`.
- `apps/api/src/config.ts`: env parsing (zod) and production guards.
- `apps/api/src/auth.ts`: `resolveUser`, `requireUser`, `authRequired`.
- `apps/api/src/errors.ts`: `ErrorBody`, `ApiError`, `notFound`, `forbidden`, `errorResponse`.
- `apps/api/src/context.ts`: `AppEnv` (context variables `db`, `config`, `requestId`, `userId`).
- `apps/api/src/dev-seed.ts`: `DEV_USERS` and `seedDevUsers()`. Temporary.
- `apps/api/src/modules/circles/{schemas,routes,service}.ts`: the only feature module so far.
- `apps/api/scripts/export-openapi.ts`: writes `packages/api-client/openapi.json`.
- `apps/api/build.mjs`: esbuild bundle to `dist/server.js`.
- `packages/db/src/schema.ts`, `packages/db/drizzle/0000_init.sql`: schema and the single migration.
- `packages/db/src/client.ts`: `createDb(url)` (pg Pool max 10, snake_case). `testing.ts`: `createTestDb()`.
  `migrate.ts`: `db:migrate`.
- `apps/app/src/app/_layout.tsx`: QueryClient (no retry on 4xx, `staleTime` 30 s), navigation theme from the
  palette, `Stack`.
- `apps/app/src/lib/api.ts`: `api` client, `unwrap()`, `RequestError` (with `fieldErrors()`), the dev-user store
  and header middleware.
- `apps/app/src/lib/storage.ts`: the platform seam for key/value preferences.
- `.github/workflows/ci.yml`: format, check, client freshness, migrations-match-schema, web build, API build.

## Entities / Models (`packages/db/src/schema.ts`)

All IDs are `text` with default `gen_random_uuid()::text`. Timestamps are `timestamptz`.

- **users**
  - Soft delete via `deletedAt`.
  - Fields: `name`, `email` (unique, nullable), `emailVerified`, `image`, `locale` (default `hy`), `city`,
    `adultConfirmedAt`, `telegramChatId` (unique).
  - Shaped to be compatible with Better Auth. Contact fields must **never** reach other users.
- **venues**: `latitude` and `longitude` are stored as text; `isPartner`. **Unused.**
- **circles**
  - FKs: `organizerId` → users, `venueId` → venues.
  - Fields: `title`, `activity`, `language` (locale enum), `city` (default Yerevan), `timeZone` (default
    Asia/Yerevan), `weekday` (smallint, 1–7), `startTime` (text `HH:mm`), `weeks` (smallint, 1–16), `capacity`
    (smallint, 3–20), `status` (`draft | recruiting | active | finished | cancelled`, default `recruiting`, never
    changed by code), `visibility` (default `private`, unused), `inviteCode` (unique), `chatLink`,
    `previousCircleId` (unused).
  - Check constraints hardcode the domain limits.
- **memberships**
  - Columns: `circleId` (cascade on circle delete), `userId`, `role` (`organizer | co_host | member`), `status`
    (`joined | waitlisted | left | removed`), `offeredAt`, `offerExpiresAt`.
  - `offeredAt` and `offerExpiresAt` are reserved for the step 1.6 waitlist offer.
  - Unique on `(circleId, userId)`; rejoining updates the same row. Index on `(circleId, status, createdAt)`.
- **meetings**
  - Columns: `circleId` (cascade), `index` (unique per circle), `startsAt`, `venueText`, `status`
    (`scheduled | cancelled | done`).
  - Named "meetings" rather than "sessions" to avoid confusion with auth sessions.
- **attendance**: primary key `(meetingId, userId)`; `rsvp` (`yes | no | maybe`), `attended`, `markedBy`.
  **Unused.**
- **notifications**: an outbox. `channel` (`telegram | email | push`), `template`, `payload` (jsonb), unique
  `dedupeKey`, `scheduledFor`, `status`, `attempts`, `lastError`, `sentAt`. **No writer or worker yet.**
- **reports**: reporter, target user or circle, reason, status. **Unused.**
- **blocks**: primary key `(blockerId, blockedId)`. Read by join (both directions), **no writer** (tests insert
  rows directly).
- **audit_log**: `actorId`, `action`, `entity`, `entityId`, `data`. **Unused.**

## Services / Business Logic

Domain (`packages/domain/src`, all pure):

- `generateSchedule({ startDate, weekday, time, weeks, timeZone }) → ScheduledMeeting[]` in `schedule.ts`.
  - The first meeting is the first `weekday` on or after `startDate`. The local wall-clock time stays fixed across
    DST.
  - Throws `RangeError` for bad weeks, time, date or zone.
- `placeNewMember(activeMembers, capacity) → 'joined' | 'waitlisted'` in `membership.ts`.
- In `invite.ts`:
  - `createInviteCode(random?)`: 10 characters of Crockford base32 (no I, L, O, U), using
    `globalThis.crypto`.
  - `isInviteCode(value)`.
  - `normalizeInviteCode(input)`: accepts full links, lower case, dashes and spaces, and maps O→0 and I/L→1.
- `limits.ts`: `MIN_WEEKS` 1, `MAX_WEEKS` 16, `MIN_CAPACITY` 3, `MAX_CAPACITY` 20.
- `policy.ts`: access-control functions (`canJoin`, `canLeave`, `canViewCircle`, `canSeeInvite`, `canSeeChatLink`, `canSeeMemberNames`, `canRemoveMember`, `canEditCircle`, `canCreateCircle`) and field-visibility projections (`firstName`, `toCircleMember`, `toInviteMember`). All API authorization decisions go through these; mapping to HTTP codes stays in the service.
- In `membership.ts` (added PR1): `waitlistPosition(orderedIds, userId) → 1-based number | null`; `seasonProgress({ meetingStartsAt, weeks, now }) → { phase, week, of, daysUntilStart }`; `nextScheduledIndex(meetings, now) → index | null`.

API services (`apps/api/src/modules/circles/service.ts`):

- `createCircle(db, organizerId, input, now?) → circleId`
  - Runs in a transaction: circle, organizer membership, meetings.
  - Retries up to 5 times on a unique violation (`23505`), which covers an invite-code collision.
  - The time zone is hardcoded to Asia/Yerevan.
- `getCircleDetail(db, circleId, userId, appUrl)`
  - Only for `joined` or `waitlisted` members; anyone else gets 404.
  - Returns the circle, meetings, joined members (`userId`, `name`, `role`), `me`, `spotsLeft`, `waitlistCount`.
  - `chatLink` is included for joined members only, and `invite` for the organizer only.
- `getInvitePreview(db, code, viewerId?)`
  - Public. Returns the organizer's first name, the first scheduled meeting, `spotsLeft`, `open`.
  - `circleId` and `myStatus` are filled only when the viewer is a member.
- `joinByInvite(db, code, userId) → { circleId, status }`
  - Runs in a transaction with `circles … FOR UPDATE`.
  - Answers 409 when the circle is not open, and 403 when there is a block or the user was removed.
  - Idempotent for members who are already joined or waitlisted.
  - Rejoining after leaving updates the existing row.
- `leaveCircle(db, circleId, userId)`
  - **Not in a transaction.** The organizer gets 409; non-members get 404.
  - Sets the status to `left`. There is no waitlist promotion yet.
- `countByStatus(db | tx, circleId)` (internal helper).

## API Endpoints / Routes

| Method and path                | Auth                      | Handler and response                     |
| ------------------------------ | ------------------------- | ---------------------------------------- |
| `GET /health`                  | public                    | `modules/health.ts`; reports DB status   |
| `GET /openapi.json`            | public                    | —                                        |
| `GET /docs`                    | public, not in production | Scalar UI                                |
| `POST /v1/circles`             | signed in                 | `createCircle` → 201 `CircleDetail`      |
| `GET /v1/circles/{id}`         | signed in, member         | `getCircleDetail` → 200 `CircleDetail`   |
| `POST /v1/circles/{id}/leave`  | signed in, member         | `leaveCircle` → 204                      |
| `GET /v1/invites/{code}`       | public; sign-in optional  | `getInvitePreview` → 200 `InvitePreview` |
| `POST /v1/invites/{code}/join` | signed in                 | `joinByInvite` → 200 `JoinResult`        |

Malformed or unknown invite codes get 404. On signed-in routes, `authRequired` answers 401 before body validation.

## Existing Patterns

- **Feature module**: `apps/api/src/modules/circles/`. zod schemas with `.openapi()`, then `createRoute` plus
  `security` plus a shared `errors` map, then service functions taking `db`.
- **Row-locked capacity**: `joinByInvite` in `circles/service.ts`. Inside one transaction it runs
  `select … for('update')`, checks blocks and the existing membership, counts, then calls `placeNewMember`.
- **Multi-insert transaction with retry**: `createCircle` in `circles/service.ts`.
- **401 before validation**: `router.use(path, authRequired)` in `circles/routes.ts`, with the guard in `auth.ts`.
- **Error envelope**: `errors.ts` and the `defaultHook` in `app.ts`, which returns `validation_error` with
  `details` of the form `[{ path, message }]`.
- **Privacy in the public preview**: `firstName()` in `packages/domain/src/policy.ts` (moved from service in PR1); `toCircleMember()` for the member list whitelist.
- **Authorization via domain policy**: services call `canJoin`, `canLeave`, `canSeeChatLink`, etc. from `@krug/domain` (root; also importable as `@krug/domain/policy` via the subpath) and map `JoinDenial`/`LeaveDenial` reasons to HTTP codes inline.
- **Platform seam**: `apps/app/src/lib/storage.ts`, a synchronous interface (web: guarded `localStorage`;
  native: memory for now).
- **API calls in the app**: `unwrap(api.GET(...))` inside `useQuery` / `useMutation`, and `RequestError` for
  field errors. See `apps/app/src/app/circles/new.tsx`.
- **Tests**: API in `apps/api/test/circles.test.ts` (per-file `setup()`, `t.call(..., { as })`, `t.makeUser`);
  domain in `packages/domain/src/schedule.test.ts`; DB in `packages/db/src/schema.test.ts`.

## Frontend Inventory (`apps/app`)

Routes (Expo Router, `src/app`):

- `/` (`index.tsx`): create a circle, or paste an invite link or code (`normalizeInviteCode` → `/i/[code]`).
  Language switcher and `DevUserBar`.
- `/circles/new` (`circles/new.tsx`): the create form with client-side validation. It currently re-types the
  `HH:mm` and `https://` rules instead of sharing them. Then `router.replace` to `/circles/[id]?created=1`.
- `/circles/[id]` (`circles/[id].tsx`): query `['circle', id]`. Leave mutation, copy the invite (expo-clipboard),
  open the chat (`Linking.openURL`). No `DevUserBar`.
- `/i/[code]` (`i/[code].tsx`): query `['invite', code]`. The join mutation invalidates only `['invite', code]`.
  The screen is remounted per dev user. `DevUserBar`.

State:

- Server data: TanStack Query, configured in `_layout.tsx`.
- Language and dev user: `storage` (persisted) plus a `useSyncExternalStore` dev-user store in `lib/api.ts`.
- There is no other global store.

Design system (`src/ui`):

- `theme.ts`: `palette.light/dark`, `space`, `radius`, `font`, `maxContentWidth` 640, `useColors()`.
- Components: `Button`, `Chips`, `Screen`, `Card`, `Text`, `TextField`, `Loading`, `ErrorView`, `useErrorText`,
  `LanguageSwitcher`, `DevUserBar`.

Other `src/lib` modules:

- `i18n.ts`: i18next setup. Saved choice, then device language (expo-localization), then `hy`. Sets `<html lang>`.
- `format.ts`: `weekdayKey`, `formatMeeting` (Intl in the circle's time zone).

Component tests: none, and no MSW.

Platform seams for phase 2:

- `storage` (native implementation needed)
- Future `session` (expo-secure-store) and notifications
- Clipboard and Linking already go through Expo modules

## Auth Quick-Reference

- **Temporary dev auth:** `DEV_AUTH=1` plus the `x-dev-user-id` header, resolved by `resolveUser` (non-deleted
  users only).
  - The API refuses `DEV_AUTH` when `NODE_ENV=production`, but the default `NODE_ENV` is `development`.
  - The app side uses `EXPO_PUBLIC_DEV_AUTH` and `DevUserBar`. Dev users: `dev-anna`, `dev-arman`, `dev-mariam`,
    `dev-davit`.
- **Guards:** `authRequired` guards `/v1/circles`, `/v1/circles/*` and `/v1/invites/:code/join`.
  `requireUser(c)` is called in the handlers.
- **Resource checks:** membership checks happen in the services. Outsiders get 404; only the organizer sees the
  invite.
- **OpenAPI:** the security scheme `devUser` is an apiKey in the header.
- **Planned:** Better Auth in step 0.7 (see `.claude/rules/auth.md`).

## Background Jobs / Cron

None. Planned:

- A notifications outbox worker (1.x)
- A waitlist offer with a 24-hour expiry (1.6), using `memberships.offeredAt` and `offerExpiresAt`

## External Integrations

- **Postgres:** Neon in production through `pg` (`createDb`). TLS must come from the URL.
- **PGlite:** local development without `DATABASE_URL`, and all tests.
- **Scalar:** the API reference at `/docs`.
- **Expo modules:** expo-clipboard, expo-localization, expo-router; `Linking` for the chat link.
- **Planned, no code yet:** Telegram, email, push, Sentry, Better Auth, EAS, hosting and previews, Open Graph
  previews for invite links.

## Audit / Event Log Action Types

None are written yet. The `audit_log` table exists; define the action names when moderation lands.

## Configuration

- **`apps/api/.env`** (from `.env.example`): `NODE_ENV`, `PORT` (8787), `DATABASE_URL`, `APP_URL`
  (http://localhost:8081), `CORS_ORIGINS`, `DEV_AUTH`.
- **`apps/app/.env.local`** (from `.env.example`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DEV_AUTH`. These are public
  and compiled into the bundle.
- **`apps/app/app.json`**: Expo config. Static single-page web output; the experimental React Compiler is on.
- **Root tooling:** `turbo.json`, `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), `eslint.config.js`
  (flat config with react-hooks), `.prettierrc.json`.
- **Vitest configs** in `apps/api` and `packages/db` set 30-second timeouts for PGlite.

## Known Schema Traps

- IDs are `text`, not `uuid`, and dev users have non-UUID IDs. Don't validate IDs as UUIDs.
- Limits are duplicated in three places: domain `limits.ts`, the DB check constraints, and API schemas (which
  import them from domain). Changing a limit needs a migration.
- `startTime` is text `HH:mm`. `weekday` follows ISO numbering (1 = Monday).
- The time zone is hardcoded to Asia/Yerevan in `createCircle`, and `city` is never set.
- An invalid calendar `startDate` such as `2026-02-31` passes the regex check, then `generateSchedule` throws
  `RangeError`, and the API answers **500**. Past start dates are also accepted.
- A Hono `HTTPException` (for example, malformed JSON) comes back with code `internal_error` but a 4xx status.
- `users.deletedAt` is filtered only in auth, not in member lists or the organizer's name.
- `circles.status` never changes, so circles can't be closed yet.
- `leaveCircle` has no transaction and no waitlist promotion.
- `removed` memberships can never rejoin, but nothing sets `removed` yet.
- 18+ (`adultConfirmedAt`) is not enforced anywhere; only the dev seed sets it.
- `DEV_USERS` is duplicated in `apps/api/src/dev-seed.ts` and `apps/app/src/lib/api.ts`.
- The app's join mutation doesn't invalidate `['circle', id]`, so data can be stale for up to 30 seconds.
- The DB pool isn't closed on shutdown. PGlite is a devDependency of the API, which is fine only because
  production requires `DATABASE_URL`.
