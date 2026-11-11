# CLAUDE.md

Template-Version: 2.3
<!-- Managed by /template-upgrade — do not remove this line. See CHANGELOG.md in the global template. -->

Krug: the same 6–8 people, one activity, one evening a week, for a whole season. Yerevan first; Armenian, Russian
and English. A TypeScript monorepo with a Hono API and an Expo app that ships as web today and **becomes the
iOS and Android apps from the same code**.

## Working rules for this repository

Team: one QA/product owner (not a programmer) and Claude, who writes the code. These rules exist so the owner can
trust what ships without reading every line.

### Non-negotiables

- Every change goes through a pull request. CI must be green. The owner tests the preview and merges; Claude never
  merges to `main` or deploys to production on its own.
- No secrets in code, chat, commits or logs. Secrets live in the hosting providers' secret settings; `.env.example`
  files document names only.
- Accounts, keys and billing belong to the owner.
- 18+ only in v1. Other people see a member's name (and later photo) only — never phone, email or Telegram id. Every
  API response that includes other people is checked for this in tests.
- Business rules go in `packages/domain` (pure, tested). The API and the app call them; they do not re-implement them.
- A behavior change comes with a test that fails without it. A bug fix starts with a test that reproduces the bug.
- Each PR description says, in plain language, what changed, how to test it (steps the owner can follow on the
  preview), and what is not done yet.
- **Keep the architecture ready for iOS and Android.** Every app change must keep "web today → native tomorrow"
  cheap: React Native primitives only, platform differences behind `src/lib` seams, Expo modules, a stable `/v1` API.
  See `.claude/rules/mobile.md`. Breaking this is a review blocker.

### Before saying "done"

```bash
pnpm format && pnpm check
pnpm --filter @krug/api-client generate   # if the API changed
pnpm --filter @krug/db db:generate        # if the schema changed
pnpm --filter @krug/app build             # if the app changed
```

and, for UI changes, open the page in a browser (phone width and desktop, light and dark, hy/ru/en) and look.

### Conventions

- TypeScript strict everywhere; no `any`. Internal packages are consumed as TypeScript source.
- API: every route declared with `@hono/zod-openapi`; errors are `{ error: { code, message, details } }`.
  Auth-protected routes answer 401 before validating input.
- App: screens in `src/app`, everything else outside it. Colors from `src/ui/theme.ts`. Text from `@krug/i18n`
  (all three languages in the same PR; Armenian marked for native review if unsure).
- Migrations: additive first, destructive a release later. Never edit an applied migration.
- Dependencies: pin exact versions for servers and tooling; in the app use `pnpm exec expo install`.
- Read `apps/app/AGENTS.md` before touching Expo APIs.

### Temporary things (must be gone before public launch)

- `DEV_AUTH` / `x-dev-user-id` and the test-user switcher: replaced by Better Auth in step 0.7.
- Armenian strings marked as drafts: native review before launch.

## Always-loaded rules

@.claude/rules/00-investigate-first.md
@.claude/rules/01-project-archetype.md
@.claude/rules/02-workflow-journal.md
@.claude/rules/architecture.md
@.claude/rules/sensitive-areas.md
@.claude/rules/mobile.md

## Read on demand — when working in these areas

| When working on                                                                                     | Read                                                             |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Sign-in, `DEV_AUTH`, `authRequired`, step 0.7 (Better Auth), who may see what                       | `.claude/rules/auth.md`                                          |
| Schema, migrations, Drizzle queries, soft delete, schema traps                                      | `.claude/rules/data-access.md`                                   |
| Joining/leaving/waitlist, transactions, row locks, notifications outbox, Telegram/email/push, audit | `.claude/rules/transactions-and-side-effects.md`                 |
| New or changed API routes, response shapes, API versioning, regenerating the client                 | `.claude/rules/api-contract.md`                                  |
| Any screen, component, Expo API, deep link, storage, app dependency                                 | `.claude/rules/mobile.md` (always loaded) + `apps/app/AGENTS.md` |
| Architecture decisions and their reasons                                                            | `docs/adr/`                                                      |
| What the owner tests by hand                                                                        | `docs/qa/README.md`                                              |

There is no multi-tenant or brand-specific logic. Language (hy/ru/en) and time zone are per circle and per user,
not per tenant.

## Skills

The skills below define methodology for the corresponding agents.
They are NOT directly invokable by the main session for routing — they run inside their respective agents' isolated contexts.

- `architect` skill → loaded by the `architect` agent
- `senior-dev` skill → loaded by the `developer` agent
- `review` skill → loaded by the `code-reviewer` and `code-reviewer-lite` agents
- `qa-planner` skill → loaded by the `qa-planner` agent
- `qa-engineer` skill → loaded by the `qa-engineer` agent
- `security` skill → loaded by the `security-reviewer` agent

## Slash commands

- `/build` — format check, typecheck, lint, tests, and the API + web builds; report errors
- `/snapshot` — generate or refresh `docs/codebase-snapshot.md`
- `/feature` — research → architect/architect-lite → developer → code-reviewer/code-reviewer-lite, with human checkpoints; ends with a compression handoff (you run `/clear`, then `/qa` with the handoff block) so QA gets fresh context
- `/review` — spawn code-reviewer or code-reviewer-lite on current uncommitted diff. Load-bearing.
- `/qa` — standalone QA workflow: plan scenarios (qa-planner) → optionally write tests (qa-engineer) → run suite (qa-runner). Use for QA-only tasks or testing mature features independently of /feature.
- `/task` — route any task through the correct agent
- `/design-parallel` — spawn two architect agents with different framings for side-by-side comparison
- `/security-audit` — spawn security-reviewer against the whole codebase or a named area (audit mode, not diff mode)
- `/resume` — recover an interrupted workflow: reads `.claude/state/journal.md` + git state, reconstructs where the pipeline stopped, continues from the recorded NEXT ACTION

## Agents (subprocess-style, isolated context)

Available via the Agent tool — see `.claude/agents/README.md` for when to use the agent vs. the corresponding skill.
The tier in parentheses (**Opus-tier** = hard judgment work, **Sonnet-tier** = pattern-following work) is the _role_. The exact model string is pinned in each agent's frontmatter and documented once in the **Model** section below — change it there, not here.

- `architect` (Opus-tier — schema/auth/transactions/new entities/new screens with platform concerns)
- `architect-lite` (Sonnet-tier — pattern-following work)
- `developer` (Sonnet-tier)
- `code-reviewer` (Opus-tier — non-trivial diffs: API services/routes, auth, schema/migrations, domain rules, `apps/app/src/lib` seams, anything touching mobile readiness)
- `code-reviewer-lite` (Sonnet-tier — small diffs: copy/i18n strings, styling with theme tokens, renames, docs)
- `qa-planner` (Sonnet-tier — scenario matrix, no code; use after code-reviewer or standalone via /qa)
- `qa-engineer` (Sonnet-tier — writes real Vitest tests from qa-planner output)
- `qa-runner` (Sonnet-tier — runs existing test suite, analyzes failures, reports GREEN/YELLOW/RED)
- `security-reviewer` (Opus-tier — conditional: spawned when a diff matches the Security override list in `.claude/skills/security/SKILL.md`, or via /security-audit; adversarial lens — injection, IDOR, SSRF, secrets, dependencies, privacy leaks)
- `infrastructure-reviewer` (Opus-tier — monorepo, config, CI, Expo/EAS and deploy health checks)

## Default task routing

Claude Code is stateless per turn. Delegation to agents is the
default for all non-trivial work. Inline handling is the exception.

### What "inline" means (the ONLY cases):

- Single-line fix: typo, comment, rename a local variable, doc wording
- Running a read-only slash command: /build
- Answering a question whose answer requires zero file reads
  (e.g. "what does the error envelope look like?" — already in context)

Everything that requires opening a file, running grep, or touching the filesystem is NOT inline. Do not read files and then answer inline.
Reading files IS the job of an agent.

### Everything else routes through agents:

| Trigger                                                                                                                | First agent                                  | Then                                    |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| User says "check", "look at", "investigate", "how does X work", "find where X is", "understand X"                      | code-researcher agent                        | architect or developer based on outcome |
| New feature, new endpoint, new entity, new screen                                                                      | architect agent                              | developer agent                         |
| Refactor, redesign, approach decision                                                                                  | architect agent                              | developer agent                         |
| Bug with unclear cause or touches multiple files                                                                       | architect agent                              | developer agent                         |
| Bug with clear single-file cause                                                                                       | developer agent                              | code-reviewer agent                     |
| Any files modified — non-trivial diff                                                                                  | code-reviewer agent (Opus-tier)              | done or qa-planner agent                |
| Any files modified — small diff                                                                                        | code-reviewer-lite agent (Sonnet-tier)       | done or qa-planner agent                |
| Mature feature needs test coverage                                                                                     | qa-planner agent                             | qa-engineer → qa-runner                 |
| User says "write tests", "add test coverage"                                                                           | qa-planner agent                             | qa-engineer agent                       |
| User says "run tests", "are tests green"                                                                               | qa-runner agent                              | —                                       |
| Tests written (by qa-engineer or a human) need quality review; user says "review these tests", "are these tests good"  | test-reviewer agent                          | qa-engineer to fix if findings          |
| Evaluating external API, library, service (Expo modules, Better Auth, Telegram, Neon, hosting)                         | researcher agent                             | —                                       |
| Diff matches Security override list (auth, external input, user-influenced queries/URLs, dependencies, crypto/secrets) | security-reviewer agent                      | developer agent if blockers             |
| User says "security audit", "is this secure", "check for vulnerabilities"                                              | security-reviewer agent (or /security-audit) | —                                       |
| Infrastructure, CI, Expo/EAS config, deploy, gitignore check                                                           | infrastructure-reviewer agent                | —                                       |
| Reviewing agent/skill/command quality                                                                                  | prompt-reviewer agent                        | —                                       |
| Validating a skill file                                                                                                | skill-checker agent                          | —                                       |

**Reviewer classification** — use code-reviewer (Opus-tier) if the diff touches any of the critical patterns for this project's archetype (see `.claude/rules/01-project-archetype.md` for which conventions are active here):

- `apps/api/src/modules/**` (routes, schemas, services), `apps/api/src/{app,auth,config,errors,server}.ts`
- `packages/db/src/schema.ts`, `packages/db/drizzle/**`
- `packages/domain/src/**` (shared business rules)
- `apps/app/src/lib/**` (platform seams, API client wrapper, storage, i18n setup), `apps/app/app.json`, `_layout.tsx`
- Any new app dependency, any DOM/browser API in app code, any `Platform.OS` branch
- Any response that includes other people (privacy), any transaction or row lock, `.github/workflows/**`,
  anything in `.claude/rules/sensitive-areas.md`

Everything else (copy and i18n strings, styling with theme tokens, a screen's layout using existing components, docs) → code-reviewer-lite (Sonnet-tier).

This applies even when the user does not mention agents.
Delegation is the default. Inline is the exception.

### Casual phrasing is not an exemption

These phrases ALWAYS route to an agent — never handled inline:

- "check X" / "look at X" / "can you check" → code-researcher
- "how does X work" / "where is X" / "find X" → code-researcher
- "make this change" / "update X" / "fix X" → developer (if plan exists) or architect first
- "review this" / "is this correct" → code-reviewer or code-reviewer-lite based on diff scope
- "what does the [external thing] do" → researcher

If the user's message contains any of these and it references code or a codebase concept, spawn the appropriate agent. Do not answer inline even if you believe you already know the answer — the agent produces
a structured output the user can reference later; inline answers do not.

### Agent handoff rules — MANDATORY transitions:

These are not suggestions. Claude must follow them:

1. **Investigation → Action boundary**
   After reading files and understanding current code — STOP.
   Do not proceed to design or implement inline.
   Announce: "Investigation complete. Spawning [agent] now."
   Then spawn the appropriate agent.

2. **Architect → Developer**
   After architect agent returns AND user approves the plan —
   spawn developer agent with the full plan as input.
   Never implement inline after architect approval.

3. **Developer phase complete → Next phase**
   After developer agent finishes one phase of a multi-phase plan —
   spawn developer agent again for the next phase.
   Never continue implementation inline after an agent returns.
   Agent ends its output with a structured block:
   PHASE_COMPLETE: N / NEXT_PHASE: N+1 / ACTION_REQUIRED: spawn developer agent.
   Detect this block and spawn the next phase agent immediately.

4. **Developer → Code-reviewer**
   After any developer agent finishes (any phase, any size) —
   classify the diff and spawn the appropriate reviewer agent automatically.
   Never skip this step. Never self-review inline.
   If the reviewer's verdict includes "security review recommended" —
   spawn the security-reviewer agent on the same diff scope before
   proceeding. Security BLOCKERS gate the commit like review blockers
   and follow the same capped fix loop.

5. **Code-reviewer → Fix loop (max 2 cycles)**
   If code-reviewer returns BLOCKERS or WARNINGS —
   spawn developer agent to fix, then spawn the same reviewer again.
   Only proceed when reviewer returns "ship" or "needs minor fixes."
   **Cap: 2 fix cycles.** If blockers survive the second fix, stop the
   loop and escalate — the design may be flawed. Offer: re-spawn architect
   with the findings, manual decision, or abort. Never run a third silent cycle.

6. **Code-reviewer approved → QA**
   After code-reviewer returns no BLOCKERS —
   spawn qa-planner agent automatically. It produces a scenario matrix
   (no code); qa-engineer writes tests from it; qa-runner executes them.
   Execution is human-driven, or main-session-driven with whatever testing
   tools the main session has access to.
   Skip only if user says "skip qa".
   Test execution in this project:
   - **Automated:** Vitest via `pnpm check` / `pnpm --filter <pkg> test`. Domain rules are unit-tested, the DB is
     tested against PGlite with real migrations, and the API is tested in-process with `app.request` through
     `apps/api/test/helpers.ts` (`setup()`, `call(method, path, { as, body })`). No server or Docker needed.
   - **UI:** there is no automated UI layer yet. The main session checks screens in a browser (Claude in Chrome)
     at phone width and desktop, light and dark, hy/ru/en, against the owner's checklist in `docs/qa/README.md`.
     The owner then tests the PR preview by hand.
   - The qa agents plan and write tests. They do not have browser tools; the boundary for UI is a written
     manual-test plan.

7. **Never resume inline after an agent returns**
   When an agent finishes and returns control to main Claude —
   the next action must be either:
   (a) Show output to user and ask for approval, or
   (b) Spawn the next agent in the chain
   Never pick up implementation where the agent left off.

## MCP servers available

No project `.mcp.json`. From the user's environment: **Claude in Chrome** (browser checks of the web app). The
`apps/app/.claude/settings.json` enables the official **Expo** plugin.

## Build & run

```bash
# Install (Node 22.12+, pnpm 10 via corepack):
pnpm install

# Check everything (what CI runs, plus its build steps):
pnpm format:check && pnpm check
pnpm --filter @krug/api build
pnpm --filter @krug/app build

# Run locally:
pnpm --filter @krug/api dev          # API on http://localhost:8787 (docs at /docs), in-memory DB unless DATABASE_URL
cp apps/app/.env.example apps/app/.env.local
pnpm --filter @krug/app dev          # press w → web app on http://localhost:8081

# Migrations:
pnpm --filter @krug/db db:generate   # after editing packages/db/src/schema.ts
pnpm --filter @krug/db db:migrate    # apply to DATABASE_URL (the API does not migrate on start)

# API client (after any API change):
pnpm --filter @krug/api-client generate
```

Environment keys (names only; values live in the hosting provider):

- API (`apps/api/.env`): `NODE_ENV`, `PORT`, `DATABASE_URL`, `APP_URL`, `CORS_ORIGINS`, `DEV_AUTH` (temporary;
  refused in production; production must set `NODE_ENV=production`)
- App (`apps/app/.env.local`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DEV_AUTH` (temporary; must be unset in
  production builds). `EXPO_PUBLIC_*` is compiled into the bundle, so never put secrets in it.

## Branching

`main` is the default branch and the PR target. Feature branches off `main`, one PR per change. CI
(`.github/workflows/ci.yml`) runs on every PR and on push to `main`. The owner merges; Claude never pushes to
`main`. (This folder is not yet a git repository; initialise it and connect it to GitHub before the first PR.)

## Model — single source of truth

The exact model strings used by this project live in two coordinated places:
the **Main session** value below, and each agent's `model:` frontmatter under
`.claude/agents/`. When you bump models, change them here and in frontmatter only —
the agent list above refers to _tiers_, not version strings, so it never drifts.

- **Main session:** `claude-sonnet-4-6`
- **code-reviewer:** `claude-fable-5` — the load-bearing agent gets the strongest model.
- **Opus-tier agents** (architect, infrastructure-reviewer, security-reviewer): `claude-opus-4-8`.
- **Sonnet-tier agents** (architect-lite, developer, code-reviewer-lite, qa-planner, qa-engineer): `claude-sonnet-4-6`.
- **qa-runner:** `claude-haiku-4-5-20251001` — mechanical run/parse/report work; bump to Sonnet if failure analysis feels shallow.

Verify availability with `/model` in Claude Code or https://docs.claude.com — fall back one tier per agent if a model isn't offered on your plan.
