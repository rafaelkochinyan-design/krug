# Working rules for this repository

Team: one QA/product owner (not a programmer) and Claude, who writes the code. These rules exist so the owner can
trust what ships without reading every line.

## Non-negotiables

- Every change goes through a pull request. CI must be green. The owner tests the preview and merges; Claude never
  merges to `main` or deploys to production on its own.
- No secrets in code, chat, commits or logs. Secrets live in the hosting providers' secret settings; `.env.example`
  files document names only.
- Accounts, keys and billing belong to the owner.
- 18+ only in v1. Other people see a member's name (and later photo) only — never phone, email or Telegram id. Every
  API response that includes other people is checked for this in tests.
- Business rules go in `packages/domain` (pure, tested). The API and the app call them; they do not re-implement them.
- A behavior change comes with a test that fails without it. A bug fix starts with a test that reproduces the bug.
- Each PR description says, in plain language, what changed, how to test it (steps the owner can follow on the
  preview), and what is not done yet.

## Before saying "done"

```bash
pnpm format && pnpm check
pnpm --filter @krug/api-client generate   # if the API changed
pnpm --filter @krug/db db:generate        # if the schema changed
pnpm --filter @krug/app build             # if the app changed
```

and, for UI changes, open the page in a browser (phone width and desktop, light and dark, hy/ru/en) and look.

## Conventions

- TypeScript strict everywhere; no `any`. Internal packages are consumed as TypeScript source.
- API: every route declared with `@hono/zod-openapi`; errors are `{ error: { code, message, details } }`.
  Auth-protected routes answer 401 before validating input.
- App: screens in `src/app`, everything else outside it. Colors from `src/ui/theme.ts`. Text from `@krug/i18n`
  (all three languages in the same PR; Armenian marked for native review if unsure).
- Migrations: additive first, destructive a release later. Never edit an applied migration.
- Dependencies: pin exact versions for servers and tooling; in the app use `pnpm exec expo install`.
- Read `apps/app/AGENTS.md` before touching Expo APIs.

## Temporary things (must be gone before public launch)

- `DEV_AUTH` / `x-dev-user-id` and the test-user switcher: replaced by Better Auth in step 0.7.
- Armenian strings marked as drafts: native review before launch.
