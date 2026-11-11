# Data access (Drizzle + Postgres)

## Setup

- Schema: `packages/db/src/schema.ts`. The client is `createDb(url)` in `packages/db/src/client.ts`
  (`pg.Pool`, max 10, `casing: 'snake_case'`). The type is `Db`.
- Tests: `createTestDb()` from `@krug/db/testing` gives a fresh in-memory PGlite with all migrations applied.
  Same SQL as production, no Docker.
- Local dev without `DATABASE_URL`: the API uses PGlite in memory, so data disappears on restart.
- Production: Neon Postgres. TLS must come from the connection URL (`?sslmode=require`); `createDb` sets no SSL
  option itself.

## Migrations

1. Edit `schema.ts`.
2. `pnpm --filter @krug/db db:generate` writes `packages/db/drizzle/NNNN_*.sql`. Read the SQL.
3. Never edit an applied migration. CI fails if the schema and migrations disagree.
4. Additive first: new columns are nullable or have a default. Removing or renaming happens one release after
   the code stops using the column, because installed apps keep calling the old API.
5. Apply with `pnpm --filter @krug/db db:migrate` (needs `DATABASE_URL`). The API does not migrate on start.

## Schema traps

- IDs are `text` with default `gen_random_uuid()::text`, not the `uuid` type. Dev users have non-UUID IDs
  (`dev-anna` …). Don't validate IDs as UUIDs in route schemas.
- `circles.startTime` is text `HH:mm`, guarded by a regex check constraint.
- `weekday` (ISO 1 = Mon … 7 = Sun), `weeks`, `capacity` and meeting `index` are `smallint` with check constraints
  that **hardcode** the domain limits (1–7, 1–16, 3–20).
- `circles.timeZone` defaults to `Asia/Yerevan` and `city` to `Yerevan`. The API currently hardcodes the time
  zone (`DEFAULT_TIME_ZONE` in `circles/service.ts`).
- `venues.latitude` / `longitude` are text. The table is unused so far.
- `memberships` is unique on `(circleId, userId)`. Leave and rejoin reuse the same row (status changes); never
  insert a second row.
- Membership status: `joined | waitlisted | left | removed`. "Active" means `joined` or `waitlisted`. `removed`
  must never be able to rejoin.
- `notifications.dedupeKey` is unique, so a reminder can never be sent twice. Use it when the outbox gets a writer.
- Tables defined but not used by code yet: `venues`, `attendance`, `notifications`, `reports`, `audit_log`.
  `blocks` is read in join but has no writer.

## Soft delete

- `users.deletedAt`: personal data is wiped on account deletion, and the row stays for stats. Today only
  `resolveUser` filters it.
- **Any new query that lists or shows people must exclude `deletedAt IS NOT NULL` users, or show them as
  "deleted user" by explicit decision.** The existing member list and organizer-name queries don't filter yet.
  Fix them when touched.
- Memberships are never deleted. Status goes to `left` / `removed`.

## Query conventions

- Services take `db: Db` (or a transaction `Tx`) as their first argument. `type Tx` is derived in
  `circles/service.ts`.
- Use the Drizzle query builder with `eq/and/or/inArray`. Never build SQL strings from input.
- Independent reads can run in `Promise.all` (see `getCircleDetail`). Reads that a write depends on run inside
  that write's transaction.
- Select only the columns you need when joining `users`. Never select `users.*` into a response path; the privacy
  rule applies.
- Counting members: `countByStatus()` in `circles/service.ts`. Reuse it; don't write a second counter.
