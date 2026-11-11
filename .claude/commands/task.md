---
description: Route any task through the correct agent — use for any non-trivial work
---

Route this task through the correct agent: $ARGUMENTS

Step 1 — Classify the task using the Default task routing table in
CLAUDE.md — that table is the single source of truth. Quick reference:
- Needs codebase investigation first? → spawn code-researcher
- Needs design/approach decision? → spawn architect (or architect-lite for pattern-following work)
- Clear implementation with approved plan? → spawn developer
- Code already written, needs review? → spawn code-reviewer / code-reviewer-lite per diff classification
- Diff matches the Security override list? → spawn security-reviewer after the code review
- External research needed? → spawn researcher
- Test planning needed? → spawn qa-planner (then qa-engineer → test-reviewer → qa-runner as needed)
If the table and this list ever disagree, the table in CLAUDE.md wins.

Step 2 — Announce which agent and why:
"This task requires [agent] because [reason]. Spawning now..."

Step 3 — Spawn the agent via Task tool.
Never handle inline. If unclear which agent, default to 
code-researcher first, then architect.

Step 4 — After agent returns, apply handoff rules from CLAUDE.md.
Show output, ask for approval, spawn next agent if needed.
