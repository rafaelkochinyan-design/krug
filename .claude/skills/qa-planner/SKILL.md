---
name: qa-planner
description: Use when producing a test scenario matrix for a feature, bug fix, or area of the codebase. Covers 10 test axes with prioritization. Output feeds directly into qa-engineer or serves as a standalone manual test guide. This skill defines the methodology used by the qa-planner agent — the main session must not load it directly.
---

## Invocation guard

This skill defines the methodology used by the **`qa-planner` agent**.
The main session must NOT load and execute this skill itself.
If loaded by the main session, stop and spawn the `qa-planner` agent via the Task tool.

---

## QA Planner

**Design the scenario matrix. Do not write test code.** Your output is a prioritized list of scenarios that either a human tester or the `qa-engineer` agent will execute.

## Process

1. Read `docs/codebase-snapshot.md` — schema traps, auth patterns, existing behavior
2. Read the feature description / diff / bug report in the task brief
3. Identify all **surfaces under test**: API endpoints, service methods, background jobs, UI flows, external integrations
4. For each surface, walk all 10 axes below — skip axes that genuinely don't apply, but state the skip explicitly
5. Assign priority (P1/P2/P3) to every scenario
6. Output the matrix + coverage summary + qa-engineer brief

## The 10 test axes

Walk every axis for every surface. Skip with explicit reason only.

**1. Golden path**
The happy case the feature was built for. One scenario per surface. No edge cases — pure success flow.

**2. Input edges**
Empty string, null/undefined, max-length string, zero, negative number, unicode (emoji, RTL text, zero-width chars), whitespace-only, extremely long input, duplicate submission, already-exists conflict, invalid enum value passed as string.
*Skip if: surface takes no user input.*

**3. State edges**
Soft-deleted records, inactive/suspended entities, legacy records missing new schema fields (NULL on new columns), orphaned records (parent deleted), records in intermediate state (e.g. partially processed). Pre-migration data behavior.
*Skip if: no persistent state involved.*

**4. Authorization boundaries**
For each auth mechanism touched:
- Valid credentials → correct access
- Expired/revoked credentials → 401
- Missing credentials → 401
- Wrong role/scope → 403
- Admin bypass (if applicable) — does it work? should it?
- Token valid but session row deleted (forced logout case)
- Cross-tenant access attempt (if multi-tenant)
*Skip if: surface has no auth at all (publicly accessible by design).*

**5. Failure modes**
External service unreachable, external service timeout (after retries), external service returns unexpected response, DB transaction rollback on external call failure, partial write without a wrapping transaction, queue/job enqueue fails.
*Skip if: no external calls or DB writes.*

**6. Idempotency**
Submit the same request twice. Replay the same background job tick. Duplicate webhook delivery. Re-import the same file. Expected: either idempotent (same result, no duplicate) or explicit conflict error. Silent duplicate creation = bug.
*Skip if: operation is explicitly non-idempotent by design — document why.*

**7. Concurrency**
Two requests racing on the same resource (double-submit, double-spend). Background job firing while a manual trigger runs the same operation. Stock/balance decrement under concurrent load (even a synthetic 2-request race).
*Skip if: operation is atomic by definition (single DB call, no shared mutable resource).*

**8. Audit & observability**
For every scenario above: is the audit log/event written? With the correct action type? Does it log on failure, skip, and duplicate — not just on success? Silent operations are a defect.
*Skip if: project has no audit log.*

**9. Rollback & recovery**
If the operation fails halfway, what's the state? Can it be retried safely? Is there a compensating action? Applies to multi-step writes, import pipelines, payment flows.
*Skip if: operation is a single atomic step.*

**10. Stack-specific axes (Vitest API/domain + manual UI)**

*In Krug there is no Playwright yet: browser/UI scenarios below become manual steps for `docs/qa/README.md` (Layer = Manual); everything HTTP is Layer = API (Vitest).*

*Browser/UI layer (Playwright):*
- **Redirect chains** — does the auth redirect send the user back to the original URL after login? Does a protected page redirect unauthenticated users and not authenticated ones?
- **Loading and error states** — does the UI show a spinner while the API call is in flight? Does it show an error message (not a blank screen) when the API fails?
- **Form validation UX** — inline validation fires on blur or on submit? Required fields highlighted before network call is made?
- **`data-testid` coverage** — are interactive elements reachable without fragile selectors? Note gaps; don't add them yourself.
- **Cross-browser** — if `playwright.config.ts` defines multiple projects (chromium, webkit, firefox), do scenarios pass on all? Flag webkit-specific regressions.

*API/contract layer (REST):*
- **Response shape stability** — do required fields always appear, even in error responses? Missing field in error body = contract violation.
- **Header correctness** — `Content-Type`, `Cache-Control`, `Location` on 201 — are they set correctly?
- **Pagination and cursor behavior** — off-by-one on `limit/offset`; cursor invalidated after delete; empty page shape (array or null?).
- **Rate limiting** — does the endpoint enforce a rate limit? Does it return 429 with `Retry-After`?

*Component layer (web-frontend archetype — Vitest/Jest + Testing Library):*
- **Render states** — loading, error, empty, and populated states each render correctly; no blank screen on any async state.
- **State-management edges** — stale cache after mutation; optimistic update rolled back on API failure; rapid navigation racing an in-flight request (stale response must not overwrite fresh state); store reset on logout.
- **Conditional rendering** — every permission/feature-flag/role branch renders the right variant; nothing leaks through for unauthorized roles (client-side hiding is UX, the API check is the real boundary — test both).
- **Form behavior** — validation timing (blur vs submit), double-submit disabled while pending, unsaved-changes guard on navigation, error recovery after failed submit keeps user input.
- **Accessibility** — keyboard-only completion of every P1 flow; focus moves to errors/modals; interactive elements have accessible names; axe scan on key pages clean of critical violations.
- **Responsive breakpoints** — P1 flows usable at the project's defined breakpoints (at minimum: mobile width + desktop); no horizontal scroll, no unreachable controls.

*Mobile (mobile-app archetype — starter set, refine per project):*
- **Lifecycle interruptions** — background the app mid-flow (incoming call, app switch) and return: state intact? In-flight operation resolved or safely retried? Process-death restore on Android.
- **Offline & flaky network** — feature behavior offline (queued? blocked with clear message?); airplane-mode toggle mid-request; sync conflict when the same record changed on server while offline.
- **Permissions** — denied path for every required permission (camera, location, notifications): graceful message, re-request flow, deep link to settings.
- **Deep links / push** — cold-start vs warm-start handling; malformed/expired link rejected safely; push tap lands on the right screen with auth respected.
- **Upgrade path** — local storage/database from the previous app version migrates without data loss.
- **Device matrix** — P1 flows on min-supported OS version + one current device per platform; small-screen and large-font (accessibility text size) rendering.

*Krug-specific (always walk these):*
- **Roles in a circle** — anonymous, signed-in outsider, waitlisted, joined member, organizer, left, removed, blocked (either direction).
- **Privacy** — every response showing other people: names only; no email/phone/telegram; invite preview = organizer's first name only. Always P1.
- **Capacity & waitlist** — exactly full, last-spot race, leave/rejoin, organizer cannot leave.
- **Time** — circle time zone, DST, start date vs weekday, invalid calendar dates (must be 400, not 500).
- **API compatibility** — would an app version built before this change still work against it? (`/v1` is a public contract.)
- **Languages & form factors** — hy/ru/en, ~390 px and desktop, light and dark, cold open from URL (`/i/<code>`, `/circles/<id>`), network down → "Нет связи" + retry. These are manual steps for `docs/qa/README.md`.
- **Mobile readiness** — for app changes: would this flow behave the same on iOS/Android (no web-only API)? Note anything that would need a native counterpart.

## Priority assignment

Assign P1/P2/P3 to every scenario:

| Priority | Criteria |
|---|---|
| **P1** | Breaks core business logic, loses data, bypasses auth, causes silent corruption. Run before every commit. |
| **P2** | Edge case that's likely to appear in production, but not blocking. Run before merge to main. |
| **P3** | Theoretical edge case, load/stress scenario, or requires live external dependency. Document but defer. |

**Rules:**
- Every golden path scenario is P1
- Every auth boundary scenario is P1
- Idempotency and concurrency are P2 unless the feature is a payment/balance operation (then P1)
- P3 scenarios must have a note explaining the dependency or condition needed to test them

## Output format

```
# QA Plan: [Feature Name]
Surfaces: [list]
Generated from: [diff hash or description]

## Scenario matrix

| # | Scenario | Surface | Axis | Layer | Priority | Expected | Notes |
|---|----------|---------|------|-------|----------|----------|-------|
| 1 | Valid order creation with all fields | POST /orders | Golden path | API | P1 | 201, order in DB, audit logged | |
| 2 | Same request submitted twice | POST /orders | Idempotency | API | P1 | Second 409, no duplicate row | Check audit log on second call |
| 3 | JWT expired | POST /orders | Auth boundary | API | P1 | 401, no DB write | |
| 4 | OrderItem quantity = 0 | POST /orders | Input edge | API | P2 | 400 validation error | |
| 5 | Stripe timeout after DB write | POST /orders | Failure mode | API | P1 | Transaction rolled back, 503 | Retry: 3 attempts then fail |
| 6 | Checkout page shows error on API failure | /checkout UI | Failure mode | Playwright | P1 | Error banner visible, no blank screen | Use page.route() to intercept |
...

## Coverage summary

**Covered axes:** Golden path, Input edges, Auth boundaries, Failure modes, Idempotency, Audit
**Not covered & why:**
- Concurrency — requires load test setup (P3, deferred)
- State edges / legacy records — no pre-migration data in current environment
**Highest-risk scenario:** #5 — Stripe timeout after DB write. If transaction rollback is missing, orders will be created without payment, causing revenue loss.

## qa-engineer brief

FEATURE: [name]
TEST LAYER: Playwright | API (Newman/curl) | Component (Testing Library) | combination
  Reason: [one sentence — why this layer for this feature]
TEST TARGETS: [list of spec files to create/extend, or API endpoints/scripts]
PRIORITY SCENARIOS: #1, #2, #3, #4, #5
PLAYWRIGHT CONFIG: n/a — no browser test layer yet (UI scenarios go to docs/qa/README.md as manual steps)
PLAYWRIGHT SPECS: n/a
COMPONENT SPECS: n/a (app has no test runner yet). Domain unit: packages/domain/src/*.test.ts; DB: packages/db/src/*.test.ts
API TESTS: apps/api/test/*.test.ts (Vitest, in-process app.request on PGlite)
AUTH APPROACH: x-dev-user-id header via t.call(method, path, { as: userId }) from apps/api/test/helpers.ts
SEED HELPER: setup() (fresh PGlite per file), t.makeUser(name), validCircle fixture — apps/api/test/helpers.ts; createTestDb() from @krug/db/testing
PATTERNS: follow existing tests at apps/api/test/circles.test.ts (API), packages/domain/src/schedule.test.ts (domain)
```

## When the matrix gets large

If scenarios exceed 20, trim P3 rows to a simple list at the bottom and keep the full matrix for P1/P2 only. A 40-row matrix with mostly P3 noise is worse than a tight P1/P2 matrix that actually gets run.
