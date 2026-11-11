---
description: Feature workflow — research → architect → developer → reviewer, with checkpoints. Ends with a compression handoff to /qa (run /clear, then /qa with the summary).
---

Execute a feature development cycle for: $ARGUMENTS

**Journal discipline (crash safety):** update `.claude/state/journal.md` per
`.claude/rules/02-workflow-journal.md` at every transition — command start,
before/after each agent, after each approval. If this session dies, /resume
rebuilds from that file. First write: now, at command start.

Follow this sequence exactly. Do not skip steps. Do not handle any
step inline. Announce each agent before spawning it.

**Stage 0 — Research (if codebase investigation needed)**

Decide first: do you need to run Stage 0?
- **Run Stage 0** when: the feature touches an unfamiliar area, the user described the problem in business terms without naming files, OR architect-tier classification (schema/auth/transaction/new entity) is likely.
- **Skip Stage 0** when: the feature is clearly pattern-following work on a familiar area, the user has already named the files/services involved, OR research from a recent prior task is still relevant. Note the skip and why in the final summary.

Snapshot freshness: before relying on `docs/codebase-snapshot.md`, check its header commit hash. If many commits or schema/entity changes landed since, offer to run `/snapshot` first.

If running:
Say: "Stage 0: Researching codebase with code-researcher agent..."
Spawn code-researcher agent with:
- Feature description: $ARGUMENTS
- Task: research relevant files, patterns, integration points,
  potential problems. Write to docs/research/[feature-name].md

Show research summary. Ask: "Research complete. Proceed to design?"
Wait for approval.

**Stage 1 — Design**
Classify the feature before spawning:
- **Opus-tier** (architect): schema change, new auth rule, transaction boundary,
  new entity, anything in sensitive-areas.md
- **Sonnet-tier** (architect-lite): new endpoint following existing pattern,
  DTO addition, simple service method, no schema/auth/transaction changes

Say: "Stage 1: Spawning [architect / architect-lite] agent..."
Spawn the appropriate agent with:
- Feature: $ARGUMENTS
- Research output from Stage 0 (if run)
- Task: produce full design doc with implementation plan

**Persist the design before asking:** write the architect's full design doc to
`docs/designs/[feature-name].md`. An approved design that lives only in chat
is unrecoverable after a crash.

Show design doc. Ask: "Design complete. Approve, revise, or abort?"
Wait for explicit approval before continuing.
On approval: journal it ("design approved", artifact path) — the developer
agent's brief is the persisted file.

**Stage 2 — Implementation (one agent per phase)**
Say: "Stage 2: Spawning developer agent for Phase [N]..."
Spawn developer agent with the approved plan from `docs/designs/[feature-name].md`.
Journal before each spawn and after each PHASE_COMPLETE.
After each phase: show summary, ask "Proceed to Phase [N+1]?"
Spawn new developer agent for each phase.
Never continue phases inline.

**Stage 3 — Review**
Classify the diff by the **Non-trivial override list** in `.claude/skills/review/SKILL.md` — that file is the single source of truth. If the diff matches any item there, route to code-reviewer (Opus-tier). Otherwise, route to code-reviewer-lite (Sonnet-tier).

Do not re-state the list here. If you find yourself second-guessing the classification, the override wins — run the Opus-tier reviewer.

Say: "Stage 3: Spawning [code-reviewer / code-reviewer-lite] agent..."
Spawn the appropriate reviewer on current diff.
Pass diff scope explicitly: `git diff $(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/main")...HEAD`
Show findings by severity.

If BLOCKERS exist:
  Ask: "Blockers found. Fix now or abort?"
  If fix: spawn developer agent → spawn same reviewer again with
  `git diff [commit-before-fixes]...HEAD` (not full branch diff)

  **Fix-loop cap:** maximum 2 fix cycles. If the reviewer still returns
  BLOCKERS after the second fix attempt, STOP the loop. Say:
  "Two fix cycles have not cleared the blockers — the design itself may be
  flawed. Options: (a) escalate to architect with the reviewer findings,
  (b) you decide manually, (c) abort."
  Wait for the user. Do not start a third silent fix cycle.

If only WARNINGS/NITS:
  Ask: "Minor findings. Fix now, defer, or proceed?"

**Stage 4 — Compression handoff to /qa**

`/feature` ends here by design. QA runs in a fresh context via the
standalone `/qa` command — running `/clear` mid-command would erase the
rest of these instructions, so the reset happens BETWEEN commands, not
inside one.

Produce the handoff summary in a fenced block the user can copy:

```
FEATURE HANDOFF: [feature name]
================================
Built: [feature description, approach taken — 2-3 lines]
Files changed:
  - path — one-line purpose (repeat per file)
Review: [ship / warnings deferred: ... / nits noted: ...]
QA constraints: [multi-tenant, background jobs, auth boundaries, or "none"]
Archetype: [from .claude/rules/01-project-archetype.md]
```

Then say:

"Feature pipeline complete (research → design → implement → review).
To run QA with clean context:
  1. Run `/clear`
  2. Run `/qa` and paste the FEATURE HANDOFF block above as the brief
Or say 'skip qa' and I'll show the final summary now."

If the user says "skip qa": show the final summary (files changed,
reviewer used and status, "QA: skipped by user", "Ready to commit?"),
journal `NEXT ACTION: none — pipeline complete (QA skipped)`, and stop.

Before showing the handoff, journal: stage 4 reached, handoff block written,
`NEXT ACTION: user runs /clear then /qa with the FEATURE HANDOFF block`.
This is the exact line /resume needs if the crash happens between commands.

Do NOT run /clear yourself. Do NOT spawn qa-planner from inside this
command — the whole point of the handoff is a fresh context.
