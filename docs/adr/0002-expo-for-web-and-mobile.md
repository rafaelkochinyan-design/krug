# 0002 — Expo (React Native) for web now and mobile later

**Status:** accepted · 2026-11-10

**Context.** We start with a web app but already know we want iOS and Android. A separate web stack (e.g. Next.js)
would mean rewriting every screen for mobile.

**Decision.** Build the client with Expo SDK 58 + Expo Router, exported as a static web app today. Phase 2 builds
the same code for iOS/Android with EAS. Only React Native primitives (View, Text, Pressable…) in screens; web-only
APIs stay behind small modules in `src/lib` (e.g. storage) with a native implementation added in phase 2.

**Consequences.** Web is a first-class target but looks "app-like" rather than "site-like". Invite-link previews in
messengers (Open Graph tags) need a small server-side piece later because the web export is a single-page app.
