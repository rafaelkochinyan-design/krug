---
description: "Standalone QA workflow — plan → (optionally) write tests → run. Use for: testing a specific feature, auditing an area of the codebase, or running a pure QA task without going through the full /feature pipeline. Accepts: feature name, file path, endpoint, or area description as $ARGUMENTS."
---

Run a QA workflow for: $ARGUMENTS

This command runs QA independently of /feature. It is the entry point for:
- Testing a feature that was already built (this session or a previous one)
- Auditing a specific area of the codebase for test coverage gaps
- Running a pure QA task assigned to you directly

**Journal discipline (crash safety):** update `.claude/state/journal.md` per
`.claude/rules/02-workflow-journal.md` at every transition. First write: now.

Follow this sequence. Do not skip steps. Do not handle any step inline.

---

## Step 0 — Classify the request

Before spawning anything, classify what $ARGUMENTS is asking for:

**A) "Plan only"** — user wants a scenario matrix but not test code.
Triggers: "write a test plan", "what should I test", "find edge cases", "qa this feature".
→ Run Step 1 only. Skip Step 2 and Step 3.

**B) "Plan + write tests"** — user wants both the plan and the actual test code.
Triggers: "write tests for", "implement tests", "add test coverage", "qa + code".
→ Run Step 1, then Step 2.

**C) "Just run tests"** — user wants to verify existing tests pass.
Triggers: "run tests", "are tests green", "check test suite", "run qa".
→ Skip Step 1 and Step 2. Run Step 3 only.

**D) "Full QA"** — plan + write + run.
Triggers: "full qa", "qa everything", "plan write and run".
→ Run Step 1, then Step 2, then Step 3.

If unclear: default to **A** (plan only) and ask at the end whether to proceed to test code.

---

## Step 1 — Scenario planning (qa-planner)

Say: "QA Step 1: Spawning qa-planner to build scenario matrix..."

Spawn `qa-planner` agent with:
- Target: $ARGUMENTS
- Task: produce a full scenario matrix using `.claude/skills/qa-planner/SKILL.md`
- Include the qa-engineer brief at the end if test code will be requested (classification B or D)
- Read `docs/codebase-snapshot.md` first

**Persist before asking:** write the full scenario matrix to
`docs/qa/[feature-name]-scenarios.md` and journal the path.

Show the full scenario matrix.

Ask: "Plan complete. Options:
  1. Use this as a manual test guide — done
  2. Generate test code for P1 scenarios → proceeds to Step 2
  3. Generate test code for all scenarios → proceeds to Step 2
  4. Revise the plan first

Your choice?"

Wait for explicit answer. If user chose 1 or didn't request code → stop here.

---

## Step 2 — Test code implementation (qa-engineer)

Say: "QA Step 2: Spawning qa-engineer to implement test code..."

Spawn `qa-engineer` agent with:
- The full qa-planner output from Step 1 (including the qa-engineer brief)
- Explicit scope: P1 only, all scenarios, or whatever the user selected
- Instruction: follow `.claude/skills/qa-engineer/SKILL.md`, mirror existing test patterns, run the suite after writing

Show the handoff output (tests written, skipped, bugs found, run result).

**Test-quality gate:** spawn `test-reviewer` agent on the files qa-engineer
just wrote. It applies the litmus test (would the test fail if the production
line it names were removed?) and catches empty/mock-only tests — the classic
failure mode of generated tests: green suites that assert nothing. If it
returns critical findings, spawn qa-engineer again with the findings to fix
the tests before proceeding. Skip this gate only if the user says so.

If bugs were found during test writing:
  Say: "qa-engineer found [N] real bug(s) during test implementation. See BUGS FOUND section above."
  Ask: "Fix the bugs now (spawns developer agent) or log them and continue?"
  Wait for answer.

If test run result is RED:
  Ask: "Tests are red. Fix now or defer?"
  If fix: spawn developer agent with the bug description → re-run qa-runner → repeat until green.

---

## Step 3 — Test run (qa-runner)

Say: "QA Step 3: Spawning qa-runner to execute the test suite..."

Spawn `qa-runner` agent with:
- Scope: the area/feature from $ARGUMENTS (run scoped, not full suite, unless explicitly asked)
- Instruction: run tests, analyze failures, report GREEN/YELLOW/RED

Show the full run report.

If RED:
  Ask: "Tests are red. Fix now or defer?"
  If fix: spawn developer agent with failure analysis → re-run qa-runner → repeat until GREEN or YELLOW.

---

## Final summary

After whichever steps ran, show:

```
QA SUMMARY: [feature/area]
==========================
Plan:    [scenarios generated, P1/P2/P3 counts] | skipped
Code:    [tests written, path] | skipped
Run:     GREEN / YELLOW / RED ([N] passed, [N] failed) | skipped
Bugs:    [N found during test writing] | none

Next step: [commit / fix bugs first / expand to P2 scenarios / done]
```
