---
description: "Standalone security audit — spawn security-reviewer against the whole codebase or a named area (not a diff). Use quarterly, before releases, or as a first pass on a codebase that has never had a security review. Usage: /security-audit [area or empty for full]"
---

Run a security audit for: $ARGUMENTS (if empty: whole codebase)

This is NOT the per-diff security review — that runs automatically via the
review pipeline when a diff matches the Security override list. This command
audits existing code.

## Step 1 — Scope

- If `$ARGUMENTS` names an area/directory/feature → audit that area.
- If empty → whole codebase, prioritized by attack surface.

For whole-codebase audits on large projects, warn first: "Full audit on a large
codebase is a long, token-heavy run. Audit by area instead? Suggested order:
auth → input parsing/controllers → outbound integrations → background jobs →
the rest." Wait for the user's choice.

## Step 2 — Spawn

Say: "Spawning security-reviewer in audit mode..."

Spawn `security-reviewer` agent with:
- Mode: audit (not diff)
- Scope: from Step 1
- Task: follow `.claude/skills/security/SKILL.md` — run available scanners
  across the scope, then apply the archetype's manual lenses to the
  highest-attack-surface code first
- Output: standard SECURITY REVIEW format, plus a final
  **Coverage note** — what was examined vs. skipped, so a follow-up audit
  can resume where this one stopped

## Step 3 — Triage

Show the full report. Then:

If BLOCKERS exist:
  Ask: "Exploitable findings. For each: fix now (spawns architect or developer
  depending on scope), create a tracked TODO, or accept the risk explicitly?"
  Security fixes that touch auth or transaction boundaries route through the
  architect first — same classification rules as any feature.

If only WARNINGS/NITS:
  Ask: "Hardening findings only. Fix the top N now, or record and move on?"

## Step 4 — Record

Append a dated summary to `docs/security-audit-log.md` (create if missing):
date, scope, scanners run, finding counts by severity, decisions taken
(fixed / deferred / accepted). This file is the audit trail showing the
project's security posture over time — reviewers and future audits read it
to see what was already accepted and why.
