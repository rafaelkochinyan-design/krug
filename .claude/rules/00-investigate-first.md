# Investigate First

Before any change — not just "read the file you're editing", but trace the full loop.

## Before touching anything (universal — every archetype)

1. Identify all related files: models, services, controllers, configs, types, tests, utilities.
2. Trace the data flow end to end through all layers. Who calls this? What does this call? What reads the data this writes?
3. Prove what already exists before claiming something doesn't. Grep, don't guess. Most "missing" things already exist under a different name.
4. Check for unnecessary operations: duplicate queries, extra round-trips, extra network calls when the data store already has the data.

## Before touching anything (archetype-conditional)

Apply each item below **only if it is active for this project's archetype** — see
`.claude/rules/01-project-archetype.md`. Do not flag the absence of an inactive
convention as a problem.

- **Schema / data model changes** (transactional-backend, data-pipeline): account for existing data — historical rows, NULL columns on legacy data, pre-migration records.
- **Audit trail** (transactional-backend, data-pipeline): does this log to an audit trail? Silent operations — including skips, duplicates, failures — are defects.
- **Soft delete** (transactional-backend, if used): every query must exclude deleted items.
- **Public API surface** (library-sdk): is this a breaking change? Does it need a semver bump or a deprecation path?
- **Determinism** (cli-tool, data-pipeline): same input → same output, correct exit codes, no hidden global state.
- **Re-run safety** (data-pipeline): is each stage idempotent if the job is retried?
- **State boundaries** (web-frontend): before adding state, prove where this data already lives — server cache, an existing store, or the URL. Duplicating server state into local state is the frontend's version of a duplicate query.
- **Lifecycle & offline** (mobile-app): trace what happens to this flow on backgrounding, process death, and network loss before changing it.

## Explain before changing

For non-trivial changes (anything beyond a one-line typo), state:
- What the code does today
- What you plan to change and why
- What else will be affected (callers, callees, cascade, transaction boundaries)

Then wait for approval. "Yes", "go ahead", "approved" — then change.

## Why this matters

This codebase has cross-cutting patterns that the compiler doesn't enforce. Unplanned code tends to break these patterns silently. Investigating first costs a few minutes; unplanned code has cost full-day reworks before.

## Past mistakes to not repeat

When a new rule or guardrail lands mid-task, audit your in-flight diff for existing violations and revert proactively — don't wait for the user to spot it.

- **Phase 2 is iOS/Android from the same code.** Before adding anything to `apps/app`, check it would work on native — a quick web-only shortcut (DOM, `window`, `localStorage`, a DOM-only npm package) turns into a rewrite later. Look for an existing `src/lib` seam first.
- **Expo changes every SDK.** Don't write Expo/React Native API calls from memory; check the versioned docs for SDK 58 (`apps/app/AGENTS.md`).
- **Rules are already in `packages/domain`.** The new-circle form re-types the `HH:mm` regex and the `https://` rule instead of using shared code — don't add more copies; move rules to domain when touching them.
- **Limits live in three places:** `packages/domain/src/limits.ts`, DB check constraints (`schema.ts` + migration SQL) and the API schemas (imported from domain). Changing a limit needs a migration too.
- **Bad input must not become 500.** `generateSchedule` throws `RangeError` for e.g. `startDate=2026-02-31`; that currently surfaces as 500. Validate in the zod schema or map the error.
- **`leaveCircle` has no transaction** and the waitlist is never promoted (step 1.6). Don't build on it as if it were safe under concurrency.
- **Soft-deleted users are only filtered in auth.** Member lists and organizer names don't filter `deletedAt` yet.
- **Stale UI after mutations:** joining only invalidates `['invite', code]`, not `['circle', id]` — invalidate every query that shows changed data.
- **`NODE_ENV` defaults to `development`.** The `DEV_AUTH` production guard only fires if the host sets `NODE_ENV=production`; `seedDevUsers` runs whenever `DEV_AUTH=1`, even against a real database.
- **This folder had no git repository** when the template was applied — check `git status` works before assuming diffs/branches exist.
