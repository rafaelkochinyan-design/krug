# Transactions and side effects

## Transactions

- Any write that touches more than one row/table, or a read-then-write decision, goes in
  `db.transaction(async (tx) => …)`. Pass `tx` (not `db`) to every helper inside it.
- **Capacity and anything "first come, first served"** (joining, taking a freed spot, accepting a waitlist offer):
  lock the circle row with `.for('update')` first, then count and decide, all in the same transaction. Model it on
  `joinByInvite` in `apps/api/src/modules/circles/service.ts`.
- Known gap: `leaveCircle` reads then updates without a transaction. When step 1.6 (waitlist offer) touches it,
  it must lock the circle row, set `left` and create the offer in one transaction.
- Retry only on specific, understood errors (`createCircle` retries an invite-code unique violation, `23505`).
  Never retry blindly.

## Idempotency

- Pressing a button twice must be harmless. Joining when already joined/waitlisted returns the current state
  (`joinByInvite`). New actions follow the same rule, or return `409 conflict` explicitly.
- The app also disables buttons while a mutation is in flight (QA C19). Both layers are required, because
  phones retry on flaky networks.

## Side effects (notifications, Telegram, email, push — step 1.x)

- Never call an external service inside a DB transaction, and never "write the DB, then send" in one handler.
- Use the **outbox**: in the same transaction as the business write, insert a `notifications` row with a
  deterministic `dedupeKey` (e.g. `reminder:<meetingId>:<userId>:24h`) and `scheduledFor`. A worker sends pending
  rows, records `attempts` / `lastError` / `sentAt`, and is safe to re-run.
- Workers (when they exist) must be idempotent, must not run in tests by default, and must be explicitly enabled
  per environment.

## Audit

- `audit_log` exists but nothing writes to it yet. When moderation lands (reports, blocks, removing a member,
  handing over a circle), write an audit row in the same transaction: `actorId`, `action`, `entity`, `entityId`,
  `data`, with no personal contact data in `data`.
