# Workflow Journal — crash-safe pipeline state

The conversation can die at any moment (power loss, crash, closed laptop). The
filesystem and git survive. This rule makes the pipeline recoverable: the
orchestrator persists its state to disk at every transition, so a fresh session
can pick up exactly where the old one stopped via `/resume`.

## The journal file

`.claude/state/journal.md` — one file, current-state style (overwrite the
STATE block, append one line to the LOG). Create `.claude/state/` if missing.

```markdown
# Workflow Journal

## STATE (overwrite this block on every update)
Updated:        2026-06-10 14:32
Command:        /feature
Feature:        voucher bulk activation
Stage:          2 — implementation, phase 2 of 3
Branch:         feature/voucher-bulk @ a1b2c3d
Artifacts:
  research:     docs/research/voucher-bulk.md
  design:       docs/designs/voucher-bulk.md  (APPROVED 2026-06-10 13:58)
  scenario matrix: —
Files changed so far:
  - src/Services/VoucherService.cs — bulk activation method (phase 1)
Approvals given:  design approved; phase 1 reviewed: ship
Last completed:   developer phase 1 (PHASE_COMPLETE: 1)
NEXT ACTION:      spawn developer agent for phase 2 with the plan's phase-2 section
Pending decisions: none

## LOG (append one line per transition)
- 14:32 developer phase 1 returned PHASE_COMPLETE
- 13:58 user approved design
- 13:40 architect spawned
```

## When the orchestrator MUST write it

One file write at each of these moments — cheap insurance, never skip:

1. **Command start** (`/feature`, `/qa`, `/task` non-trivially) — record command, target, stage 0
2. **Before spawning any agent** — record which agent, with what brief/artifact
3. **After any agent returns** — record outcome (PHASE_COMPLETE, verdict, report path)
4. **After any user approval or decision** — record it verbatim ("design approved", "skip qa", "defer warnings")
5. **Command end** — set `NEXT ACTION: none — pipeline complete (committed: yes/no)`

The single most important field is **NEXT ACTION** — write it as an instruction
a cold-started Claude could execute without any other context.

## Persist artifacts, not just pointers

State is only recoverable if the artifacts exist on disk:
- Research reports → `docs/research/<feature>.md` (already the convention)
- **Design docs → `docs/designs/<feature>.md`** — the orchestrator writes the
  architect's output there before asking for approval. An approved design that
  lived only in chat is unrecoverable; never let that happen.
- QA scenario matrices → `docs/qa/<feature>-scenarios.md` when 4a completes
- Reviewer findings with open BLOCKERS/WARNINGS → record them in the journal
  STATE block (they're small); resolved findings just get a LOG line

## Git interaction

The journal complements git, not replaces it. Recommend (don't force) that the
project COMMITS `.claude/state/journal.md` — that makes recovery work across
machines too. If the user prefers it untracked, add it to `.gitignore`; it
still survives crashes on the same machine.

## Honesty rule

The journal records what HAPPENED, never what is about to happen as if done.
Write "spawning developer phase 2" only in NEXT ACTION; move it to LOG only
after the agent actually returned. A journal that lies about progress is worse
than no journal.
