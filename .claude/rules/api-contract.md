# API contract (Hono + zod-openapi → generated client)

Mobile apps stay installed for months, so the API is a public contract (ADR 0003).

## Adding or changing a route

1. Define zod schemas in `modules/<area>/schemas.ts`. Name them with `.openapi('Name')`. Import limits from
   `@krug/domain`.
2. Declare the route with `createRoute`:
   - path under `/v1`, `tags`, `summary`
   - `security` for signed-in routes
   - `request` (params/body)
   - `responses` including `...errors`
3. Add the `authRequired` guard for signed-in paths (see `auth.md`).
4. Write the service function. Use `ApiError` / `notFound` / `forbidden` / `conflict` for errors, never ad-hoc
   JSON.
5. Write tests in `apps/api/test/*.test.ts` that cover:
   - success
   - validation (400 + `details`)
   - 401 before validation
   - outsider access
   - privacy (no email/phone/telegram in responses about other people)
6. Run `pnpm --filter @krug/api-client generate` and commit `openapi.json` + `src/generated/schema.ts`. CI fails
   if they're stale.
7. Fix the app's compile errors. They are the point: a renamed field breaks the build, not users' phones.

## Compatibility

- **Allowed in `/v1`:** new routes, new optional request fields, new response fields.
- **Not allowed in `/v1`:** removing or renaming fields, changing types or nullability, making optional input
  required, tightening validation on existing input, changing error codes, or changing the meaning of a status.
  These need `/v2`.
- The app must tolerate unknown response fields and unknown enum values (show a safe default).

## Known contract gaps (fix when touched, with a test first)

- An invalid calendar `startDate` (e.g. `2026-02-31`) makes `generateSchedule` throw `RangeError`, which surfaces
  as **500** instead of **400 validation_error**.
- A Hono `HTTPException` (e.g. malformed JSON body) is reported with code `internal_error` while keeping its
  4xx status.
- Only `POST /v1/circles` has a 401 test; `join` and `leave` don't.
