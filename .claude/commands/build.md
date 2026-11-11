---
description: Build the project and report errors
---

Run the project's checks and builds and report the result. Run from the repo root via the Bash tool, in this order, and keep going after a failure so the report is complete:

1. `pnpm format:check` — Prettier
2. `pnpm check` — typecheck + lint + Vitest in every package (Turborepo)
3. `pnpm --filter @krug/api build` — esbuild bundle of the API
4. `pnpm --filter @krug/app build` — static web export of the Expo app (set `EXPO_PUBLIC_API_URL=https://api.example.invalid` if no `.env.local` exists, as CI does)

If `node_modules` is missing, say so and suggest `pnpm install` — do not install on your own.

- If everything succeeds, say so in one line per step (include warning count if non-zero).
- If something fails, list errors grouped by package and file with line numbers.
- Do NOT propose fixes unless the user follows up asking for them.
- Do NOT start the dev servers.
