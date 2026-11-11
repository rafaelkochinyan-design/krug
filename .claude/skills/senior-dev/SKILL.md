---
name: senior-dev
description: Use to implement a feature, fix, or refactor AFTER the architect agent (or architect-lite) has produced an approved plan. Implements following project patterns. Runs a self-review pass before declaring done.
---
## Invocation guard

This skill defines the methodology used by the **`developer` agent**.
The main session must not load this skill directly. If it has,
spawn the `developer` agent via the Task tool with the approved plan
as the brief.

## Senior Developer

**Implement what's already been planned.** Do not re-architect mid-implementation. If the approved plan or design turns out to be wrong, stop and escalate back to the `architect` agent — do not silently expand scope.

## Before writing a line

1. Confirm an approved plan or design exists in the conversation. If it doesn't, refuse and direct the user to spawn the `architect` agent first.
2. Re-read the files being touched. Copy existing patterns rather than invent new ones.
3. Read `.claude/rules/01-project-archetype.md` and answer the self-review checklist below — but **only the items active for this project's archetype.**

### Pre-code checklist — universal (every archetype)

- Am I duplicating code paths? One path, not two.
- How many network calls? What's the minimum?
- Am I building one query/operation with composed filters, or duplicating blocks?
- Does this introduce hidden global state or non-determinism?

### Pre-code checklist — archetype-conditional

Apply each only if its archetype is active (see `01-project-archetype.md`):

- **transactional-backend, data-pipeline** — How many DB round-trips? Can it be one query? Is every significant event logged to the audit trail?
- **transactional-backend** — Multi-step write? Wrapped in an explicit transaction with rollback. DB write + external side-effect (email, API, file op)? One atomic event with rollback. Touches soft-deleted records? Every query excludes deleted items.
- **transactional-backend, web-frontend (API)** — Is the response wrapped in the standard envelope? Is authorization explicit on every new endpoint?
- **library-sdk** — Does this change the public API surface? Is backward compatibility preserved, or is a semver bump + deprecation note needed?
- **cli-tool** — Correct exit codes? stdin/stdout contract honored? No interactive prompt where a flag belongs?
- **data-pipeline** — Is each stage idempotent on re-run? Are partial failures recoverable?
- **web-frontend (UI)** — Loading/error/empty states designed for every async surface? State placed at the right boundary (server cache vs client state vs URL)? Effects have complete deps and cleanup? Keyboard/focus/ARIA handled? Responsive at the project's breakpoints?
- **mobile-app** — State survives backgrounding and (Android) process death? Offline path defined — queued or blocked-with-message? Permission-denied path handled for every required permission? Tokens in Keychain/Keystore, never plain prefs/AsyncStorage? Heavy work off the main thread?

- **Krug** — Have I read `.claude/rules/mobile.md`? Is the failing test written first (behavior change or bug fix)? For Expo / React Native APIs: did I check the versioned Expo docs (`apps/app/AGENTS.md`) instead of memory? Does the change touch anything in `.claude/rules/sensitive-areas.md`?

## Implementation rules

**General**
- TypeScript strict, no `any`, no non-null `!` without a reason the type system can't see. Internal packages are imported as `@krug/*` source.
- Business rules go in `packages/domain` (pure, no I/O) with unit tests. API and app call them.
- A behavior change comes with a test that fails without it; a bug fix starts with a reproducing test.

**App (`apps/app`) — keep it ready for iOS/Android**
- React Native primitives and `src/ui` components only; no DOM elements or browser globals in `src/app` / `src/ui`.
- Platform-specific code lives behind a `src/lib` seam (`.web.ts` / `.native.ts` or one interface like `storage.ts`).
- Install packages with `pnpm exec expo install <pkg>`; prefer Expo modules.
- Screens in `src/app` only (Expo Router); read params with `useLocalSearchParams` and validate them.
- Server data through TanStack Query with `api` + `unwrap` from `src/lib/api.ts`; invalidate every affected query after a mutation; buttons disabled while pending.
- Loading / error (with retry) / empty states from `src/ui/States.tsx`.
- Colors and spacing from `src/ui/theme.ts` only; text from `@krug/i18n` in hy, ru and en in the same change (mark uncertain Armenian as draft).

**API (`apps/api`)**
- Every route via `createRoute` under `/v1` with zod schemas, `security` and `...errors`; signed-in paths guarded with `authRequired` so 401 comes before validation; `requireUser(c)` in the handler.
- Logic in `service.ts` functions taking `db`; errors via `ApiError` / `notFound` / `forbidden` — never ad-hoc JSON. Outsiders get 404.
- Multi-step writes and read-then-write decisions in `db.transaction`; capacity logic locks the circle row (`.for('update')`).
- Responses about other people expose names only — select explicit columns from `users`, never `users.*`.
- Additive changes only in `/v1`. After any API change run `pnpm --filter @krug/api-client generate`.

**Database**
- Schema in `packages/db/src/schema.ts` + generated migration; never edit an applied migration; additive first.
- Exact versions for server/tooling dependencies.

## After implementing

Run a self-review pass on the diff — again, only the items active for this archetype:

### Universal
- No duplicated code paths or query blocks?
- No new public symbols / error keys / config invented without approval?
- Does it build cleanly?

### Archetype-conditional (see `01-project-archetype.md`)
- **transactional-backend, data-pipeline** — DB round-trips minimized? Audit logs written for significant events (including duplicates, skips, failures)?
- **transactional-backend** — Soft-delete filters in place on every affected query? Transaction boundaries correct for multi-step writes? Authorization explicit on new endpoints?
- **library-sdk** — Backward compatibility preserved or breakage documented?
- **cli-tool** — Exit codes and I/O contract verified?
- **data-pipeline** — Re-run produces the same result (idempotent)?
- **web-frontend** — New async surfaces show loading/error/empty (verify, don't assume)? No effect-dependency warnings introduced? Lists keyed by stable IDs? Logout still clears all user state?
- **mobile-app** — Tested one backgrounding interruption on the changed flow? Offline toggle on the changed feature behaves as designed? No secrets landed in plain storage or the JS bundle?

### Krug
- `pnpm format && pnpm check` green; client regenerated if the API changed; migration generated if the schema changed; `pnpm --filter @krug/app build` if the app changed.
- No DOM / browser global / web-only package added to the app outside a seam?
- All three languages added; no hard-coded user-visible text?
- Privacy: no email/phone/telegram of other people in any response; a test asserts it?
- UI change: note for the main session to check phone width + desktop, light + dark, hy/ru/en in a browser.

Summarize what changed in 2-4 sentences with the files touched. Then stop — don't loop into running tests or committing unless asked.
