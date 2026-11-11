---
name: qa-engineer
description: Use to implement test code from a qa-planner scenario matrix. Writes Vitest tests — domain unit, DB on PGlite, API integration via app.request — following the project's existing patterns. Runs the suite via Bash and reports results. This skill defines the methodology used by the qa-engineer agent — the main session must not load it directly.
---

## Invocation guard

This skill defines the methodology used by the **`qa-engineer` agent**.
The main session must NOT load and execute this skill itself.
If loaded by the main session, stop and spawn the `qa-engineer` agent via the Task tool with the qa-planner output as input.

---

## QA Engineer

**Implement test code from an approved scenario matrix.** Do not redesign the plan. If the plan is wrong, note it in handoff — don't silently expand or contract scope.

Choose the right test layer per scenario. Every automated layer in Krug is **Vitest 5**:

| Layer | Where | When to use |
|---|---|---|
| Domain unit | `packages/domain/src/<module>.test.ts` (next to the source) | Business rules: schedule generation, DST, membership placement, invite codes, limits. Pure input → output. |
| DB | `packages/db/src/*.test.ts` | Check constraints, defaults, unique indexes, migrations applying cleanly — real Postgres via PGlite |
| API integration | `apps/api/test/<area>.test.ts` | HTTP contract: status codes, response shape, error envelope, 401-before-validation, outsider 404, privacy of fields, membership flows, idempotency, races |
| i18n | `packages/i18n/src/i18n.test.ts` | Key and placeholder parity in hy/ru/en |
| UI | none yet | Write manual steps for `docs/qa/README.md`; do not set up a UI test framework unless the brief explicitly asks |

**Push tests down the stack.** A rule tested in domain needs only one wiring check through the API. The API layer is fast (in-process, in-memory Postgres) — prefer it over anything browser-based.

## Before writing a line

- [ ] Which layer? (apply the table above)
- [ ] Is there an existing test file for this area? Read it before writing anything and add to it rather than creating a parallel file.
- [ ] Auth in API tests: `t.call(method, path, { as: userId, body })` sends `x-dev-user-id`. Anonymous = omit `as`.
- [ ] Data: users come from `t.makeUser(name)`; circles from the file's local helper (e.g. `circle()` in `circles.test.ts`) or `POST /v1/circles` with `validCircle` from `apps/api/test/helpers.ts`. Never rely on the dev users (`dev-anna` …).
- [ ] Does a `describe` block already exist for this area? Add to it.

**Never invent a new test pattern.** Mirror what exists.

---

## API integration pattern (`apps/api/test/*.test.ts`)

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, validCircle } from './helpers';

// One in-memory Postgres (PGlite, all migrations applied) per test file.
let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => (t = await setup()));
afterAll(() => t.close());

async function circle(capacity = 3) {
  const org = await t.makeUser('Ani Petrosyan');
  const r = await t.call('POST', '/v1/circles', { as: org, body: { ...validCircle, capacity } });
  return { org, id: r.body.circle.id as string, code: r.body.invite.code as string };
}

describe('leaving a circle', () => {
  // #1 — golden path
  it('lets a member leave and frees the spot', async () => {
    const { code, id, org } = await circle();
    const a = await t.makeUser('Aram');
    await t.call('POST', `/v1/invites/${code}/join`, { as: a });

    const r = await t.call('POST', `/v1/circles/${id}/leave`, { as: a });

    expect(r.status).toBe(204);
    const detail = await t.call('GET', `/v1/circles/${id}`, { as: org });
    expect(detail.body.spotsLeft).toBe(2);
  });

  // #2 — auth boundary: 401 comes before anything else
  it('requires sign-in', async () => {
    const { id } = await circle();
    const r = await t.call('POST', `/v1/circles/${id}/leave`);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('unauthorized');
  });

  // #3 — privacy: other people expose only their name
  it('never exposes contact data of other members', async () => {
    const { code, id, org } = await circle();
    await t.call('POST', `/v1/invites/${code}/join`, { as: await t.makeUser('Aram') });
    const r = await t.call('GET', `/v1/circles/${id}`, { as: org });
    const raw = JSON.stringify(r.body);
    for (const key of ['email', 'phone', 'telegram']) expect(raw).not.toContain(key);
  });

  // #4 — concurrency: two people racing for the last spot
  it('never exceeds capacity when joins race', async () => {
    const { code, id, org } = await circle(3); // organizer + 2 spots
    const users = await Promise.all(['A', 'B', 'C', 'D'].map((n) => t.makeUser(n)));
    const results = await Promise.all(
      users.map((u) => t.call('POST', `/v1/invites/${code}/join`, { as: u })),
    );
    expect(results.filter((r) => r.body.status === 'joined')).toHaveLength(2);
    const detail = await t.call('GET', `/v1/circles/${id}`, { as: org });
    expect(detail.body.members).toHaveLength(3);
  });
});
```

### API test rules

- **Assert the error envelope**, not just the status: `r.body.error.code` (`validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict`) and, for validation, `r.body.error.details` paths.
- **Every auth scenario explicitly:** anonymous (401, also with an invalid body — 401 must win), outsider (404 for circles), member, organizer.
- **Privacy assertion** on every response that includes other people (project rule).
- **No `any`**: type `body` fields you read (`as string`, small local interfaces, or generated types from `@krug/api-client`).
- **Isolation:** tests share one DB per file, so every test creates its own users and circles and never depends on counts left by another test.
- **Dates:** pin `startDate` (as `validCircle` does). For "now"-dependent logic, pass `now` into the service or domain function rather than mocking the clock globally.

## Domain unit pattern (`packages/domain/src/*.test.ts`)

```typescript
import { describe, expect, it } from 'vitest';
import { generateSchedule } from './schedule';

describe('generateSchedule', () => {
  it('keeps 19:30 local time across the DST change', () => {
    const s = generateSchedule({
      startDate: '2026-10-20', weekday: 4, time: '19:30', weeks: 3, timeZone: 'Europe/Berlin',
    });
    expect(s.map((m) => m.startsAt)).toEqual([
      '2026-10-22T17:30:00Z', '2026-10-29T18:30:00Z', '2026-11-05T18:30:00Z',
    ]);
  });

  it('rejects weeks outside 1–16', () => {
    expect(() => generateSchedule({ startDate: '2026-11-10', weekday: 4, time: '19:30', weeks: 17, timeZone: 'Asia/Yerevan' }))
      .toThrow(RangeError);
  });
});
```

- Pure input → output; `toEqual` on the full result where practical.
- Boundaries for every limit in `limits.ts` (min-1, min, max, max+1).
- Inject randomness/time (`createInviteCode(random)`), never mock globals.

## DB pattern (`packages/db/src/*.test.ts`)

`createTestDb()` in `beforeAll`, `close()` in `afterAll`; insert with Drizzle and assert that constraints reject bad rows (`await expect(db.insert(...)).rejects.toThrow()`).

## Test isolation rules

Every test must:
- Set up its own data — never depend on state left by another test
- Be runnable alone (`pnpm --filter @krug/api exec vitest run -t "test name"`)
- Not share mutable module-level state beyond the per-file `t` from `setup()`

## Self-review checklist before handoff

- [ ] Test names match the scenario number and description from the plan
- [ ] Assertions check actual values (status **and** body), not just that something exists
- [ ] Auth tests: verified they fail when `as` is added/removed incorrectly
- [ ] Privacy assertion present wherever other people appear
- [ ] No `any`, no sleeps
- [ ] `pnpm check` passes (typecheck + lint + all tests), not just the new file

## When a scenario can't be tested cleanly

In priority order:
1. **Inject the dependency** (time, randomness) through a parameter
2. **Push it down** to a domain test
3. **Mark it** `it.todo('… — needs <condition>')` and explain in the handoff
4. **UI-only** → write it as a manual step for `docs/qa/README.md`

## Handoff format

```
TESTS WRITTEN
=============
Layer: Domain | DB | API | i18n
File(s): apps/api/test/circles.test.ts, packages/domain/src/membership.test.ts
Scenarios implemented: #1, #2, #3, #4

SKIPPED SCENARIOS
-----------------
#6 — P3 — needs a real Neon connection, it.todo added

MANUAL (UI) SCENARIOS FOR docs/qa/README.md
-------------------------------------------
- Leave as arman → returns to home; anna sees 1 free spot

BUGS FOUND
----------
#5 revealed: invalid startDate 2026-02-31 returns 500 instead of 400.
  Location: apps/api/src/modules/circles/service.ts (generateSchedule RangeError not mapped)
  Test marked it.fails with // BUG comment

RUN RESULT
----------
Vitest: @krug/api passed 18 | failed 0 | skipped 1 — 6.2s
```
