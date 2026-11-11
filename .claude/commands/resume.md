---
description: Resume an interrupted workflow after a crash, power loss, or new session. Reads .claude/state/journal.md + git state, reconstructs exactly where the pipeline stopped, and continues from the recorded NEXT ACTION.
---

Resume interrupted work.

## Step 1 — Read the journal

Read `.claude/state/journal.md`.

**If it exists:** extract the STATE block — command, feature, stage, artifacts,
approvals, last completed step, NEXT ACTION.

**If it does NOT exist:** fall back to forensics and say you're doing so:
- `git status` + `git diff --stat` — uncommitted work in progress?
- `git log --oneline -5` — recent commits hinting at a feature mid-flight?
- Newest files in `docs/research/`, `docs/designs/`, `docs/qa/` — artifacts
  from an interrupted pipeline?
Report the best reconstruction you can, clearly marked as inferred, and ask
the user to confirm or correct before continuing.

## Step 2 — Cross-check the journal against reality

The journal records intent; git records truth. Verify before trusting:

- Branch and commit in STATE vs. `git branch --show-current` + `git log -1 --format=%h`
- "Files changed so far" vs. `git status --porcelain` + `git diff --name-only`
- Every artifact path in STATE actually exists on disk
- If STATE says a phase completed but the diff shows no corresponding changes
  (or vice versa — more changes than recorded), flag the drift explicitly

**If everything matches:** proceed.
**If there's drift:** show both versions side by side and ask the user which
is correct. A likely cause: the crash happened mid-write — the work is more
or less advanced than the last journal entry. Never silently trust the
journal over the diff.

## Step 3 — Report the reconstruction

Show a compact recovery summary:

```
RESUME: [feature]
=================
Pipeline:    [command], stage [N] — [stage name]
Approved:    [list of approvals from STATE]
Artifacts:   [research/design/matrix paths, with APPROVED markers]
Code state:  [N files changed, matches journal: yes/no]
Last done:   [last completed step]
NEXT ACTION: [verbatim from journal]
```

Ask: **"Continue with this next action, adjust, or start fresh?"**
Wait for explicit confirmation — do not auto-continue.

## Step 4 — Continue the pipeline

On confirmation, execute the NEXT ACTION exactly as the interrupted session
would have:

- If it names an agent to spawn → spawn it with the persisted artifact as the
  brief (the design doc from `docs/designs/`, the scenario matrix from
  `docs/qa/`, etc. — these files ARE the recovered context; pass file contents,
  not summaries from memory you don't have)
- If it was awaiting a user approval → re-present the persisted artifact and
  ask for the decision
- If it was mid-fix-loop → re-spawn the reviewer on the current diff first to
  re-establish ground truth, then continue the loop (cap still applies)
- Resume journal writes immediately per `.claude/rules/02-workflow-journal.md`
  — the first write is a LOG line: "resumed via /resume at [time]"

All normal handoff rules apply from this point — /resume restores position,
it does not grant shortcuts.

## If the journal says the pipeline completed

STATE shows `NEXT ACTION: none — pipeline complete`: report that, show whether
the work was committed, and ask what's next. Nothing to resume is a valid
answer.
