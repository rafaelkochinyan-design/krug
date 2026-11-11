---
name: qa
description: Use to produce a test matrix for a drafted or implemented feature/fix. Covers golden path, input/state edges, auth boundaries, failure modes, idempotency, concurrency, and audit verification. No test code written unless explicitly asked — output is a scenario matrix the user can execute against.
---
## Invocation guard

This skill defines the methodology used by the **`qa` agent**.
The main session must not load this skill directly. If a test plan
is needed, spawn the `qa` agent via the Task tool.

## QA

**Design the test matrix, don't write tests** (unless the user asks). Output is a list of scenarios with inputs, expected behavior, and notes on traps.

## Process

1. Read the feature/fix description or the diff.
2. Identify the surfaces under test — API endpoint(s), service method(s), background job, external integration.
3. For each surface, walk the axes below and list scenarios. Skip axes that are clearly not applicable, and say so.
4. Output a matrix + a coverage statement.

## Test axes

**Golden path** — the happy case the feature was built for. One scenario per surface.

**Input edges** — empty, null, max length, zero, negative, unicode, whitespace-only, very long strings, duplicates, already-exists, invalid enum value as string.

**State edges** — soft-deleted records, inactive entities, legacy records without new schema fields (NULL columns, pre-migration rows), orphaned records (records whose parent was deleted — remember cascade behavior is inconsistent across the schema).

**Authorization boundaries** — for each auth mechanism touched: valid credentials, expired credentials, missing credentials, wrong role/policy, admin bypass if applicable. For token-based auth: token valid but session row missing (forced logout case).

**Failure modes** — external service connect failure; external service timeout (after retries exhausted); downstream API rejection; DB transaction rollback on external failure; partial write without transaction.

**Idempotency** — re-run the same operation: does it produce duplicates, errors, or is it safely idempotent? Re-submit the same request; replay the same background job tick; duplicate POST of the same payload.

**Concurrency** — two requests racing on the same resource; background job firing while a manual trigger runs; stock/balance decrement race.

**Audit** — for every scenario above, is the audit log written correctly with the right action type? Including failure, skip, and duplicate cases. Silent operations are a defect.

**Roles in a circle** — anonymous, signed-in outsider, waitlisted, joined member, organizer, left, removed, blocked (either direction). Every flow under each role that can reach it.

**Privacy** — every response that shows other people: names only, no email/phone/telegram; public invite preview shows organizer's first name only.

**Capacity & waitlist** — exactly full, one spot left with two people racing, leave then rejoin, organizer cannot leave.

**Time** — circle time zone (Asia/Yerevan), DST in other zones, start date on the meeting weekday vs after it, invalid calendar dates.

**Languages & devices** — hy/ru/en (longer strings), phone width ~390 px and desktop, light and dark, opening a screen cold from its URL, network down then retry.

## Output format

```
| # | Scenario                                | Axis         | Expected                              | Notes                         |
|---|-----------------------------------------|--------------|---------------------------------------|-------------------------------|
| 1 | Valid request with all required fields  | Golden path  | 200 OK, resource created, audit log   |                               |
| 2 | Same request submitted twice            | Idempotency  | Second returns conflict or is no-op   | Check audit log for both      |
| 3 | External API times out                  | Failure mode | Transaction rolled back, 503 returned | Retry policy: 3 attempts      |
| ...                                                                                                                    |
```

End with:
- **Covered:** (axes exercised)
- **Not covered & why:** (out of scope, requires load test, requires a real external key, etc.)
- **Highest-risk scenario:** (the one most likely to reveal a bug)
