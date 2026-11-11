# Project Archetype

This file is the single switch that tells every agent which conventions apply to
**this** project. The methodology (research → design → implement → review → QA) is
universal. The *specific defaults* — audit logging, transaction wrapping, soft-delete,
money precision — are NOT. They came from a transactional backend and are wrong (or
just noise) for a library, a CLI, a frontend, or a data pipeline.

`/apply-template` sets the archetype below from the research report. Everything else
reads it instead of assuming "backend".

## Archetype

**ARCHETYPE:** `mobile-app`

Krug's product is an Expo (React Native) app that ships as a web app today and as iOS/Android apps from the same code in phase 2. Keeping that move cheap is the main architecture rule (`.claude/rules/mobile.md`). While the app is web-only, apply the mobile conventions as **design constraints** (seams, Expo modules, no DOM, cold-open deep links, loading/error/empty states, secure token storage); device-only checks (process death, permission dialogs, offline sync) become active when native builds start.

## What each archetype turns ON

Agents (developer, code-reviewer, architect) treat the conventions below as active
**only if the row's archetype matches the one set above.** If a convention's archetype
does not match, the agent must NOT flag its absence as a defect.

| Convention | Active for archetypes |
|---|---|
| Audit-log every significant event (incl. skips/duplicates/failures) | transactional-backend, data-pipeline |
| Wrap multi-step writes in an explicit transaction with rollback | transactional-backend |
| DB write + external side-effect must be one atomic unit | transactional-backend, data-pipeline |
| Soft-delete filters on every query | transactional-backend (only if the project uses soft delete) |
| Standard response/error envelope on every endpoint | transactional-backend, web-frontend (API layer) |
| Explicit authorization on every endpoint | transactional-backend, web-frontend (API layer) |
| Money columns use fixed precision (e.g. decimal(18,4)) | transactional-backend (only if the project handles money) |
| Account for legacy rows / NULL columns on schema changes | transactional-backend, data-pipeline |
| Accessibility + responsive checks on UI changes | web-frontend |
| Component/unit test layer (Testing Library) expected alongside E2E | web-frontend |
| Explicit loading / error / empty states on every async UI surface | web-frontend, mobile-app |
| Lifecycle safety: state survives backgrounding, interruption, process death | mobile-app |
| Offline behavior + sync conflict handling on every network feature | mobile-app |
| Permission flows handle denial and "ask again" gracefully | mobile-app |
| Secure storage for tokens/secrets (Keychain / Keystore, never plain prefs) | mobile-app |
| Deep links validated before navigation/action | mobile-app |
| Public API surface / semver / backward-compat checks | library-sdk |
| Deterministic output, exit codes, stdin/stdout contracts | cli-tool |
| Idempotency + re-run safety on each stage | data-pipeline |
| No build step / link + asset integrity checks | static-content |

## How agents use this

- **investigate-first** and **senior-dev** read this file and skip checklist items whose
  archetype does not match.
- **code-reviewer** does not raise a BLOCKER for a missing convention that is inactive
  for this archetype (e.g. "no transaction wrapper" on a `library-sdk` project is not a
  finding).
- **qa-planner** weights its scenario matrix toward the archetype's active concerns
  (e.g. accessibility for `web-frontend`, idempotency for `data-pipeline`).

## Multiple concerns in one repo

If the project genuinely spans two archetypes (e.g. a web-frontend with its own API
layer), set the *primary* archetype above and note the secondary one here so agents
apply both relevant sets:

**Secondary:** the API (`apps/api` + `packages/db` + `packages/domain`) is `transactional-backend`. Apply its conventions there: explicit transactions (with row locks for capacity), standard error envelope, explicit authorization on every route, soft-delete filtering for `users.deletedAt`, legacy-row handling on schema changes. Audit logging becomes active when moderation actions arrive (`audit_log` table exists, unused). There are no money columns.
