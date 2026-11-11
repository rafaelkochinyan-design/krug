# 0003 — HTTP API with Hono and OpenAPI-generated client

**Status:** accepted · 2026-11-10

**Context.** Mobile apps stay installed for months, so the API is a public contract that must not break silently.

**Decision.** A separate Node API (Hono + `@hono/zod-openapi`). Every route has a zod schema; the OpenAPI document
is generated from them; the app's client (`packages/api-client`) is generated from that document. CI fails if the
committed client does not match the API. Routes are versioned under `/v1`.

**Consequences.** A renamed field breaks the app's build, not the app in people's hands. Breaking changes require a
`/v2` route while old app versions are still in use.
