---
description: Generate or refresh docs/codebase-snapshot.md — machine-readable index of services, entities, patterns, and auth. Run after significant changes or weekly. Takes ~10-15 minutes on first run.
---

Generate a codebase snapshot for Krug.

Say: "Generating codebase snapshot — spawning code-researcher agent..."

Spawn code-researcher agent with:
- Task: produce docs/codebase-snapshot.md
- This is not a feature research report — it is a standing reference
  document that other agents will read instead of re-reading source files.
- Follow the snapshot format below exactly.
- Write directly to docs/codebase-snapshot.md
- Add header: "Generated: {date} at commit {short git hash from `git rev-parse --short HEAD`}.
  Refresh after significant schema, service, or pattern changes."
  The commit hash lets agents check freshness: if many commits (or any
  migration/entity changes) landed since, the snapshot is advisory, not authoritative.

## Snapshot format to produce

~~~markdown
# Codebase Snapshot
Generated: {YYYY-MM-DD} at commit {short-hash}. Refresh after significant schema, service, or pattern changes.

## Service inventory
One line per API service function and domain function: name — file path — responsibility — signature

## API routes
One line per route: method path — auth (public/signed-in) — request schema — response schema — service function

## Entity quick-reference
One line per Drizzle table in `packages/db/src/schema.ts`: name — soft-delete/status column — key field types/gotchas — FK cascade behavior — used by code yes/no

## Existing patterns
For each pattern: name, file:line reference, one-sentence description of what makes it the canonical example

## Auth quick-reference
Current auth mechanism (DEV_AUTH / x-dev-user-id until step 0.7, then Better Auth): middleware (`resolveUser`, `authRequired`, `requireUser`), which `/v1` routes are public vs signed-in, production guards

## Background jobs / cron
One line per worker/job (none as of the first snapshot; the `notifications` outbox has no writer yet): name — trigger/schedule — what it does — idempotency key — environment guard

## External integrations
One line per integration: name — service class — config section — key method

## Audit / event log action types
`audit_log.action` values actually written by code (none yet) — so agents don't invent inconsistent names

## Frontend inventory
Also list the platform seams in `apps/app/src/lib` (what each abstracts, web implementation, native status) — this is what phase 2 (iOS/Android) builds on.
- Routes/screens: one line per route — path — component/screen — auth guard
- Stores / global state: one line per store/context — what it owns — persistence (none / storage / server cache)
- Data fetching: library (e.g. TanStack Query / SWR / fetch wrappers) — where query definitions live — invalidation conventions
- Design system: component library path — theming approach — breakpoints
- Component test setup: runner config path — renderWithProviders helper path — MSW handlers path (if any)

## Known schema traps
Bullet list — the non-obvious things: wrong ID types, string-typed numerics, special-cased columns, soft-delete column name inconsistencies
~~~

After the agent writes the file:
Say: "Snapshot written to docs/codebase-snapshot.md. Review it before
using — the agent may have missed recently added services or migrations."

## When to re-run /snapshot

- New entity or model added
- New service registered in DI container
- New background job added
- New auth pattern introduced
- Weekly as a baseline refresh

Note: developer agents append one-line entries to the snapshot after each
feature. /snapshot does a full regeneration — use it when drift accumulates
or after multiple features have landed.
