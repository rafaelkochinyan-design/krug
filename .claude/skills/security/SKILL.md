---
name: security
description: Security review methodology used by the security-reviewer agent. Adversarial lens — injection, authz flaws (IDOR), SSRF, secrets, unsafe deserialization, dependency vulnerabilities, crypto misuse. Archetype-conditional. NOT loaded by the main session — spawn the security-reviewer agent instead.
---
## Invocation guard

This skill defines the methodology used by the **`security-reviewer` agent**
(spawned conditionally after code review, or via `/security-audit`). The main
session must not load this skill directly. If a security review is needed,
spawn the `security-reviewer` agent via the Task tool.

## Mindset

The code-reviewer asks "does this follow our patterns?" You ask **"how do I
abuse this?"** Every finding must name the attack, not just the smell:
who the attacker is, what they control, what they get. "Missing validation"
is a smell; "unauthenticated user controls `path` and can read arbitrary
files via `../`" is a finding.

## Security override list — when this skill's agent should run at all

A diff is security-relevant if ANY of these are true:

- Adds/changes authentication or authorization logic (middleware, attributes, policies, token handling, session code)
- Parses or stores external input: request bodies, query params, headers, file uploads, webhooks, message-queue payloads
- Builds queries, commands, paths, or URLs from any user-influenced value
- Makes outbound HTTP requests where any part of the URL/headers/body is user-influenced
- Changes a dependency manifest (package.json, *.csproj, requirements.txt, lockfiles)
- Touches crypto, hashing, random generation, signing, or token issuance
- Reads/writes secrets, connection strings, or environment-sensitive config
- Deserializes data (JSON with type handling, XML, binary formats, YAML)
- Executes processes, eval, or dynamic code loading

If none match, a security review is not needed — say so in one line and stop.

## Step 1 — Deterministic scanners first (if available)

Run what exists; skip silently what doesn't. Scanners beat you at these jobs —
your value is interpreting their output and finding what they can't.

- Dependencies: `pnpm audit --prod` (pnpm workspace; run from the repo root)
- Secrets: `gitleaks detect --no-banner` or `git grep -nE` for obvious patterns (connection strings, `api[_-]?key\s*=`, PEM headers) in the diff scope
- Note in the report which scanners ran and which were unavailable.

## Step 2 — Manual lenses

### Universal (every archetype)
- **Injection** — any string concatenation into SQL/commands/paths/templates from user-influenced data. Parameterization present?
- **Authorization logic (IDOR)** — for every endpoint/method touched: can authenticated user A pass user B's ID and succeed? Is the ownership check on the *resource*, not just the route?
- **Secrets** — anything sensitive in code, config committed to repo, or logs? Errors/log lines leaking tokens, hashes, internal paths?
- **Error handling** — do failure paths leak stack traces, SQL, or internal structure to the caller?
- **Dependency delta** — new/updated packages: known-vulnerable versions, suspicious or typo-squatted names, unnecessary scope?

### Archetype-conditional (check `.claude/rules/01-project-archetype.md`)
- **transactional-backend / web-frontend (API)** — SSRF on outbound calls with user-influenced URLs; mass assignment / over-binding on DTOs; missing rate limiting on auth and expensive endpoints; insecure deserialization (e.g. polymorphic type handling); JWT validation actually verifying signature, expiry, audience; multi-tenant data isolation (tenant ID from token, never from request body).
- **web-frontend (UI)** — XSS sinks (innerHTML, dangerouslySetInnerHTML, unsanitized templates); token storage (localStorage vs httpOnly cookies); CSP regressions; open redirects on user-influenced navigation.
- **library-sdk** — malicious-input hardening on every public entry point (the caller is untrusted); ReDoS in regexes applied to caller input; prototype pollution (JS); unsafe defaults that downstream users will ship.
- **cli-tool** — command injection via shell interpolation of args; path traversal on user-supplied paths; symlink races on temp files; secrets echoed to stdout/history.
- **mobile-app** — tokens/secrets in Keychain (iOS) / Keystore (Android), never SharedPreferences/UserDefaults/AsyncStorage plaintext; nothing sensitive hardcoded in the bundle (JS bundle and native strings are extractable); deep links validated before triggering actions or navigation (scheme hijacking, parameter injection); WebViews: JS bridges minimal, file access off, URLs allow-listed; certificate pinning if the project claims it — verify it actually applies to all clients; screenshots of sensitive screens masked where the project requires it; logs scrubbed of tokens/PII (device logs are readable on-device).
- **data-pipeline** — SSRF/file-read via user-influenced source URLs or paths; injection through "trusted" upstream data that's actually external; PII written to logs or intermediate storage without need; credentials for sources/sinks handled per-environment.

### Krug-specific
- **Privacy leaks (highest priority):** any response that includes other people must expose only names (later photos) — never email, phone, `telegramChatId`, `city`, `adultConfirmedAt`. Check explicit column selection from `users`, and that the public `GET /v1/invites/{code}` shows only the organizer's first name and no member names.
- **IDOR on circles:** circle IDs are guessable-resistant UUIDs but must still be checked: only `joined`/`waitlisted` members can read `/v1/circles/{id}`, outsiders get 404; only the organizer gets the invite link; only joined members get `chatLink`.
- **Invite codes:** 10-char Crockford base32 (~50 bits) from `globalThis.crypto.getRandomValues`; never `Math.random`. Enumeration of `/v1/invites/{code}` should be rate-limited once public (no rate limiting exists yet — flag new public endpoints).
- **Dev auth:** `x-dev-user-id` lets anyone act as any user when `DEV_AUTH=1`. Verify it can't be enabled in production (`config.ts` guard + `NODE_ENV=production` set by the host), that no production app build sets `EXPO_PUBLIC_DEV_AUTH`, and that nothing new starts trusting the header.
- **Blocks and removals:** a blocked person (either direction) or a `removed` member must not get back in through join, rejoin or any new flow.
- **18+:** flows that create accounts or join circles must not let minors through once `adultConfirmedAt` is enforced (step 0.7).
- **External links:** `chatLink` and future URLs must be `https://` only (zod); the app opens them with `Linking.openURL` — no `javascript:` or other schemes.
- **Mobile app:** nothing secret in `EXPO_PUBLIC_*` or `app.json` (the bundle is public); session tokens in `expo-secure-store` on native, never in `storage`/AsyncStorage/localStorage; deep-link params (`/i/[code]`, `/circles/[id]`) validated before any action.
- **Logs:** the access log must stay free of bodies, query strings, tokens and personal data.

## Proportionality

Same discipline as the review skill: do NOT manufacture findings. A diff that
matched the override list but turns out clean gets: scanners run, lenses
checked, "no security findings. **ship**." Do not pad with theoretical risks
that don't apply to this code.

## Output format

```
SECURITY REVIEW: [scope]
Scanners: [ran: ... | unavailable: ...]

BLOCKERS:   (exploitable now, or secrets exposed)
  1. path/File.ext:42 — [attack: who/what/impact] — [fix direction]
WARNINGS:   (exploitable under realistic conditions, or defense-in-depth gaps)
  1. ...
NITS:       (hardening opportunities)
  1. ...
```

End with one line: **ship** / **needs changes** / **blocker**.
Findings are advisory to the orchestrator — the developer agent or user
decides and implements fixes; you never edit files.
