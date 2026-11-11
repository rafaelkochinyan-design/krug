---
description: Spawn two architect agents in parallel with different framings to explore a design decision side-by-side
---

Explore a design decision by spawning two `architect` agents with intentionally different framings, then compare the outputs. This is a capability the /architect skill cannot replicate — it requires actual parallelism and independent reasoning.

## Step 1 — Get the two framings

If the user provided two framings in the command args, use them. Otherwise ask:

- **What's the design question?** (e.g., "how the waitlist offer works when someone leaves (step 1.6)", "Better Auth sessions for web and native (step 0.7)", "where meeting reminders are scheduled and sent")
- **What are the two framings to compare?** Some example axes:
  - "web-first now, native seam later" vs. "design for native first, web adapts"
  - "decide synchronously in the request (row lock)" vs. "decide in a worker via the notifications outbox"
  - "extend the existing `/v1` route additively" vs. "add a new route / `/v2`"
  - "cookie session for web + token for native" vs. "one bearer-token model for every client"
  - "extend `memberships` with new columns" vs. "add a separate table"

If the user can't articulate two framings, suggest two that make sense for the question and ask them to approve, swap, or refine.

## Step 2 — Spawn both architects in parallel

In a **single assistant message**, make two Agent tool calls in parallel — one architect agent per framing. Each brief must be **self-contained** and include:
- The design question
- ONLY its own framing (do NOT include the other framing; each agent should reason independently from its starting assumption)
- Pointer to the relevant `.claude/rules/` files
- Pointer to `.claude/skills/architect/SKILL.md` for methodology

Do not let the agents see each other's outputs or framings.

## Step 3 — Compare the outputs

When both return, produce a comparison:

- **Agreements** — what both designs converge on (same entity choices, same authorization pattern, same transaction boundaries). Convergence from two independent reasons is strong signal.
- **Divergences** — where they disagree, and why. Tie each divergence back to the framing that drove it.
- **Hidden assumptions surfaced** — places where one framing forced consideration of an issue the other glossed over (e.g. cache invalidation timing appeared under "freshness" but not "read-heavy").
- **Overall shape** — are these fundamentally the same design with different labels, or genuinely different approaches?

Ask the user: **"pick A / pick B / hybridize / re-run with refined framings / cancel?"**

Do NOT pick the winner yourself. This command exists to give the user independent inputs, not to pre-decide. If the user asks you to recommend one, do so only after they've seen both outputs — and state explicitly which framing's priorities you're weighting.
