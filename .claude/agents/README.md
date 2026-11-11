# Agents

Subagents for Krug. Each has a corresponding skill — the **skill** is for in-conversation work, the **agent** is for isolated subprocess-style invocations.

## When to use agent vs. skill

| Role | Skill (in-conversation) | Agent (isolated subprocess) |
|---|---|---|
| Design | `architect` skill — iterative design discussion with you | `architect` agent — fresh-eyes design in isolation, or parallel design exploration |
| Implementation | `senior-dev` skill — writing code while we converse | `developer` agent — implementing from an already-approved plan in isolation |
| Code review | `/review` slash command — review with full conversation context (spawns the code-reviewer agent) | `code-reviewer` agent — fresh-eyes review uncontaminated by design discussion; **use before commits** |
| QA planning | `/qa` skill — test planning while we discuss | `qa-planner` agent — isolated scenario matrix; no test code; feeds into qa-engineer |
| QA implementation | — (always agent) | `qa-engineer` agent — writes real test code from qa-planner output |
| QA execution | — (always agent) | `qa-runner` agent — runs the test suite, reports GREEN/YELLOW/RED |

### Rule of thumb

- **Skill** if you want me to do the work in this conversation, with full context of what we've said.
- **Agent** if you want the work done in an isolated subprocess — fresh eyes, no assumptions from our chat, can be spawned in parallel. Especially valuable for code review, where isolation avoids "I already agreed this was fine" bias.

### Not all agents earn their keep equally

The isolation cost (fresh-context setup, cold-start time, can't see prior discussion) isn't always paid back. Here's the honest ranking of when each agent genuinely beats its skill counterpart:

| Agent | Isolation value | Strength of case |
|---|---|---|
| `code-reviewer` | Catches what I'd rubber-stamp because I helped write it | **Strongest — load-bearing.** Use before every commit on non-trivial work. |
| `architect` | Avoids conversational anchoring; enables parallel design exploration via `/design-parallel` | **Medium-strong** — depends on whether the conversation has already locked in a direction |
| `qa-planner` | Thinks of edges the implementer's mental model rationalized away | **Strong** — isolation from implementation context is the whole point. Always run isolated. |
| `security-reviewer` | Adversarial lens uncontaminated by "we built it this way for a reason" | **Strong, but conditional** — only runs when the diff hits the Security override list, or via /security-audit |
| `qa-engineer` | Writes tests from a clean plan without implementation bias | **Medium** — mirrors qa-planner benefit; parallelism bonus when plan is ready |
| `qa-runner` | Deterministic execution environment, clean failure analysis | **Always useful** — no meaningful in-conversation alternative for test execution |
| `developer` | Parallelism only; not a quality improvement | **Weakest** — use to run feature B in a subprocess while feature A stays in the main conversation, otherwise use the skill |

**If you remember one rule:** always spawn the `code-reviewer` agent before committing non-trivial work. The others are situational; that one is load-bearing.

### Thin agents, fat skills

Each agent file's body is intentionally thin — methodology, checklists, and output formats live in the corresponding skill (`.claude/skills/<name>/SKILL.md`). Agents establish isolation and handoff; skills hold the actual rules. Keep edits to the skill, not the agent.

## Chain workflow — `/feature`

The `/feature` slash command orchestrates all agents in sequence with human checkpoints:

```
user feature request
       │
       ▼
  architect agent  ──▶ (you: approve / revise / abort?)
       │  approved
       ▼
  developer agent  ──▶ (you: proceed to review?)
       │  yes
       ▼
  code-reviewer agent  ──▶ (you: fix now / defer / proceed?)
       │  proceed
       ▼
  [handoff block shown — user runs /clear, then /qa]
       │
       ▼
  qa-planner agent  ──▶ (you: plan only / write tests / skip?)
       │  write tests
       ▼
  qa-engineer agent  ──▶ (you: fix bugs found? / continue?)
       │  continue
       ▼
  qa-runner agent  ──▶ (you: GREEN=commit / RED=fix?)
       │
       ▼
  done
```

No full auto-pilot. Each stage waits for explicit approval.

## Invoking individually

Any agent can be invoked directly via the Agent tool, without going through `/feature`:

- `architect` — when you want isolated design exploration (e.g., comparing options in parallel)
- `developer` — when you have an approved plan and want it implemented in isolation
- `code-reviewer` — **before any commit on a non-trivial change**
- `qa-planner` — when you want a scenario matrix without pulling in design/implementation context

## Tool permissions per agent

| Agent | Tools |
|---|---|
| `architect` | Read, Grep, Glob, WebSearch, WebFetch |
| `developer` | Read, Write, Edit, Bash, Grep, Glob |
| `code-reviewer` | Read, Grep, Glob, Bash (read-only git operations) |
| `security-reviewer` | Read, Grep, Glob, Bash (read-only: scanners + git) |
| `qa-planner` | Read, Grep, Glob |
| `qa-engineer` | Read, Write, Edit, Bash, Grep, Glob |
| `qa-runner` | Bash, Read, Grep, Glob |

## Important caveats

- **Isolated context means no shared memory.** Each agent invocation starts cold. Whoever spawns the agent must include a self-contained brief.
- **PROACTIVELY / MUST BE USED** language in agent descriptions is a strong nudge — not mechanically enforced. Main Claude decides when to spawn.
