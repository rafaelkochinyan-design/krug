---
name: review
description: Use for project-specific code review on the current branch or staged changes. Reviews with project-specific lenses — soft-delete filters, transaction wrapping, authorization, error keys, audit logging, and framework-specific patterns. Complements the built-in /review skill; run both for comprehensive coverage.
---
## Invocation guard

This skill defines the methodology used by the **`code-reviewer` agent**
(invoked via the `/review` command). The main session must not load
this skill directly to perform a review. If a review is needed,
spawn the `code-reviewer` agent via the Task tool — or use `/review`,
which spawns it for you.

## Review

**Diff review with project-specific lenses.** Generic code quality is handled by the built-in `/review`. This skill catches what the generic one won't: framework patterns, schema traps, and cross-cutting rules specific to this codebase.

## Proportionality — read this first

Match the depth of your output to the scope of the change. Do NOT manufacture findings to justify having been invoked. An empty findings list on a trivial diff is a pass, not a failure.

- **Trivial diff** (comment-only, typo fix, whitespace, dead-code removal, renaming a local variable, adding docs, formatting, string-literal wording): one-line verdict. Do NOT walk the checklist. Do NOT produce "N/A" findings. Example output: *"Comment-only change in ActionTypes.cs:12. No findings. **ship**."*
- **Small diff** (one or two methods, fewer than ~50 lines changed, no schema/auth/transactions/sensitive areas touched): run only the checklist items clearly in scope. Skip the rest in silence — do not list them as "not applicable."
- **Non-trivial diff** (new endpoint, new service, schema change, migration, transaction boundary, background job, auth attribute, anything touching sensitive areas): full review using the Process and checklist below.

If you're unsure which bucket the diff falls into, read the diff first before deciding depth. A 500-line diff that happens to be all generated migration code is still "trivial" review-wise; a 10-line diff that adds an authorization attribute is not.

**Non-trivial override — diff is non-trivial if ANY of these are true, regardless of line count:**

- Touches `apps/api/src/modules/**` or `apps/api/src/{app,auth,config,errors,server,dev-seed}.ts`
- Adds, removes, or changes `authRequired` / `requireUser` usage, or which routes are public
- Changes `packages/db/src/schema.ts` or adds a migration in `packages/db/drizzle/`
- Changes a business rule in `packages/domain/src/`
- Touches `apps/app/src/lib/**`, `apps/app/app.json`, `apps/app/src/app/_layout.tsx`, or adds any app dependency
- Introduces a DOM element, browser global (`window`, `document`, `localStorage`…) or `Platform.OS` branch in app code
- Adds or changes a `/v1` route, request or response schema (public contract for installed apps)
- Adds or changes a response that includes other people (privacy)
- Modifies transaction boundaries or row locks
- Touches anything listed in `.claude/rules/sensitive-areas.md` or `.github/workflows/**`

This list anchors classification to objective diff properties, not judgment. When in doubt, the override wins — run the full review.

**Security escalation check** — separately from depth classification, check the diff against the **Security override list** in `.claude/skills/security/SKILL.md` (auth/authz changes, external input parsing, user-influenced queries/commands/URLs, dependency manifest changes, crypto/secrets/deserialization, process execution). If it matches, append to your verdict line: `+ security review recommended — diff matches security override: [which item]`. The orchestrator spawns the security-reviewer agent; you do not perform the security review yourself.

## Process

1. Get the diff. Default: `git diff $(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/main")...HEAD`. If the user is mid-change, use staged (`git diff --cached`) or unstaged (`git diff`). Ask if unclear.
2. Classify the diff by the Proportionality rules above.
3. For small/non-trivial diffs: list files changed and walk them against the checklist.
4. Output findings as a numbered list grouped by severity: **Blocker** / **Warning** / **Nit**.
5. End with a one-line verdict.

## Project checklist

**Mobile readiness (BLOCKER if violated — `.claude/rules/mobile.md`)** — no DOM elements or browser globals in `src/app` / `src/ui`; platform-specific code only behind `src/lib` seams; app packages installed with `expo install` and native-capable; screens open cold from their URL; no breaking change to `/v1` or `/i/<code>`.

**Shared rules** — business logic lives in `packages/domain`; flag any rule re-implemented in a route handler or screen (e.g. retyped limits, time regex, capacity math).

**Privacy** — responses including other people expose names only; explicit column selection from `users`; a test asserts no email/phone/telegram. Public invite preview shows organizer's first name only.

**Soft delete** — new queries that list or show people exclude `users.deletedAt IS NOT NULL` (or show "deleted user" by explicit decision). Memberships are never deleted; status moves to `left` / `removed`.

**Transactions** — multi-step writes and read-then-write decisions inside `db.transaction`, with `tx` passed down; capacity/waitlist logic locks the circle row (`.for('update')`).

**Side effects** — no external calls (Telegram, email, push) inside a transaction or straight after a write in a handler; use the `notifications` outbox with a deterministic `dedupeKey`.

**Authorization** — every route explicitly public or behind `authRequired`; resource-level checks in the service; outsiders get 404; acting user id only from `c.get('userId')`.

**Error codes** — only the existing codes (`validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `internal_error`) via `ApiError`; flag new codes and ad-hoc error JSON. Domain `RangeError`s must not leak as 500 for bad input.

**API contract** — zod schemas with `.openapi()`, `createRoute` with `security` and `...errors`, client regenerated (`packages/api-client`) in the same diff.

**Migrations** — generated, additive, existing rows handled; applied migrations untouched; domain limits and check constraints changed together.

**Tests** — a behavior change has a test that fails without it; a bug fix has a reproducing test; auth (401 before validation) and privacy covered.

**i18n** — every new string in hy, ru and en; no hard-coded user-visible text; uncertain Armenian marked as draft.

**Audit** — when moderation actions arrive (remove member, block, report, hand over), they write `audit_log` in the same transaction.

**Frontend lenses (web-frontend archetype — keep these if the project is a frontend):**

**Effect & lifecycle hygiene** — every effect's dependency array is complete and intentional; cleanup functions on subscriptions/listeners/timers; no state updates after unmount; no derived state duplicated into useState when it can be computed.

**Render discipline** — list items keyed by stable IDs (never index when reordering is possible); expensive children memoized only when profiling justifies it; no new object/array/function identities passed to memoized children per render.

**Async UI states** — every new async surface handles loading, error, AND empty explicitly; failed mutations roll back optimistic updates; no unguarded `.data` access on in-flight queries.

**State boundaries** — server cache (query lib) vs client state vs URL state kept distinct; no copying server data into local state "to edit it" without a sync-back story; logout clears every store holding user data.

**Accessibility regression** — interactive elements remain reachable by keyboard; new modals/menus trap and restore focus; icons-only buttons have accessible names; color is never the only signal.

**Bundle hygiene** — new heavy dependencies justified; route-level code splitting respected; no accidental import of a server-only or full library where a sub-path import exists.

**Theme and layout** — colors/spacing only from `src/ui/theme.ts`; works at ~390 px and desktop, light and dark; touch targets ≥ 44; text survives longer Armenian/Russian strings.

**Schema rules** — IDs are `text` (UUID via `gen_random_uuid()::text`); don't validate IDs as UUIDs (dev users aren't); times as `timestamptz`, wall-clock settings as `weekday` + `startTime` + `timeZone`.

## Output format

```
BLOCKERS:
  1. path/to/File.ext:42 — missing soft-delete filter on new `GetActive` query.
  ...
WARNINGS:
  1. ...
NITS:
  1. ...
```

End with one line: **ship** / **needs changes** / **blocker**.
