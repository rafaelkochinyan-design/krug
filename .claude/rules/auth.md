# Auth

## Current state (temporary, until step 0.7)

- There is no real sign-in. `DEV_AUTH=1` makes the API trust the `x-dev-user-id` header as the user's id.
- `resolveUser` (`apps/api/src/auth.ts`) runs on every request:
  - When `config.devAuth` is on and the header is present, it looks up a non-deleted user with that id and sets
    `c.get('userId')`.
  - Otherwise `userId` is `undefined`.
- `authRequired` guards routes before validation. `requireUser(c)` returns the id or throws
  `401 unauthorized`.
  - Protected today: `/v1/circles`, `/v1/circles/*`, `/v1/invites/:code/join`.
  - Public: `GET /v1/invites/{code}`, `/health`, `/openapi.json`, `/docs` (outside production).
- Guards in `config.ts`:
  - `NODE_ENV=production` with `DEV_AUTH=1` throws at startup.
  - Production also requires `DATABASE_URL`.
  - Caveat: `NODE_ENV` defaults to `development`, so the host **must** set `NODE_ENV=production`.
- Dev users `dev-anna`, `dev-arman`, `dev-mariam` and `dev-davit` are seeded by `seedDevUsers()` when `DEV_AUTH=1`.
  The list is duplicated in `apps/app/src/lib/api.ts`.
- App side: `EXPO_PUBLIC_DEV_AUTH=1` adds the header via openapi-fetch middleware and shows `DevUserBar`.
  It must be unset in production builds. CI doesn't check that yet (planned for 0.7).
- OpenAPI declares the `devUser` apiKey scheme, and routes use `security = [{ devUser: [] }]`.

## Rules for any new route

1. Decide explicitly: public or signed-in. Signed-in routes are added to the `router.use(path, authRequired)`
   lines and the handler calls `requireUser(c)`.
2. Authorization is checked on the **resource**, in the service: membership in the circle, organizer role, etc.
   Return `404` to outsiders for private resources.
   **Authorization decisions go through `@krug/domain` policy functions** (`packages/domain/src/policy.ts`),
   never inline. For example, use `canLeave`, `canJoin`, `canSeeInvite`, etc. This keeps rules testable and
   in one place.
3. Never take the acting user's id from the body or the query. It always comes from `c.get('userId')`.
4. Test it: anonymous → 401 (and 401 even with an invalid body); outsider → 404/403; the right user → success.

## Step 0.7 (Better Auth) — constraints for whoever designs it

- `users` is already shaped like Better Auth's `user` model.
- The API serves native apps too, so session auth must work with a bearer/header token, not only cookies.
- Tokens on native go in `expo-secure-store`, behind a `src/lib/session` seam (see `mobile.md`).
- Remove `DEV_AUTH`, `x-dev-user-id`, `DevUserBar`, `DEV_USERS`, the CORS allow-header and the OpenAPI `devUser`
  scheme in the same step, and add the CI check.
- Enforce 18+ (`adultConfirmedAt`) at sign-up.
