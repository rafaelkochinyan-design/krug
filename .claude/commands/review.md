---
description: Quick code review — spawn the code-reviewer agent on the current uncommitted diff
---

Spawn the `code-reviewer` agent via the Agent tool. Brief:

- The current diff. Default: run `git diff` (unstaged) AND `git diff --cached` (staged); concatenate and pass both. If the branch has been pushed elsewhere or the user says so, use `git diff $(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/main")...HEAD` instead. Ask if the scope is ambiguous.
- An explicit note: **isolated review — do not assume any prior conversation. Review only the diff against `.claude/rules/`.**
- Pointer to the rules (`.claude/rules/`) and the skill-source-of-truth (`.claude/skills/review/SKILL.md`).

Relay the agent's findings to the user as-is — grouped by Blocker / Warning / Nit with the one-line verdict at the end. Do not re-summarize severity, reorder findings, or rephrase them. The agent's output IS the product.

If the diff is empty, report "no uncommitted changes to review" and stop.

This command exists to make the "always code-review before commit" habit trivially easy — use it liberally.
