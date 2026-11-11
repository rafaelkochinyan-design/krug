# 0001 — One TypeScript monorepo (pnpm + Turborepo)

**Status:** accepted · 2026-11-10

**Context.** One developer (Claude) and one QA owner. Web now, iOS and Android later, one API. Rules such as
"how many people fit in a circle" must not drift between server and app.

**Decision.** A single repository with pnpm workspaces and Turborepo. Everything in TypeScript (strict). Shared code
lives in `packages/*` and is consumed as source.

**Consequences.** One PR can change the API, the client types and the screen together, and CI checks them together.
The cost is a bit of tooling (workspaces, Metro monorepo support), which Expo supports out of the box since SDK 54.
