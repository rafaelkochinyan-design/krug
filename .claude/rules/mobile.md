# Mobile readiness — the main architecture rule

Krug ships as a web app today. **The same code becomes the iOS and Android apps in phase 2** (ADR 0002).
Every change to `apps/app` and to the API must keep that move cheap: phase 2 should mean "add native
implementations behind existing seams and run EAS", never "rewrite screens".

If a change would make phase 2 harder, stop and say so before writing it. Treat a violation of this file as a
**BLOCKER** in review, not a nit.

## The app (`apps/app`)

**Only React Native primitives in screens and components.**
- Use `View`, `Text`, `Pressable`, `ScrollView`, `FlatList`, `TextInput`, `Image` (or `expo-image`) and the
  components in `src/ui`.
- Never use DOM elements (`div`, `span`, `button`, `input`), `document`, `window`, `navigator`, `localStorage`,
  `sessionStorage`, `alert`/`confirm`, or CSS files / class names in `src/app` or `src/ui`.
- Styles come from `StyleSheet` / style props with tokens from `src/ui/theme.ts`. No hex colors outside `theme.ts`.

**Platform differences live behind a small module in `src/lib`, with one interface.**
- The pattern is `src/lib/storage.ts`: a synchronous interface; web uses guarded `localStorage`, native uses an
  in-memory fallback until phase 2 swaps in persistent storage behind the same interface.
- For new platform-specific behavior, use platform files (`thing.web.ts` + `thing.native.ts`, or `thing.ts` as the
  shared default) or a `Platform.OS` branch *inside `src/lib`*, never in a screen.
- Screens import the seam (`@/lib/storage`), never the platform API directly.
- Anything that today only works on web (clipboard fallback, `Linking`, file download, share) gets a seam the
  moment it's added, even if the native side is a TODO that returns a safe default.

**Expo first.**
- Read `apps/app/AGENTS.md`: Expo changes every SDK. Check the `expo` major version and the versioned docs before
  using any Expo / React Native API. Do not trust memory.
- Prefer Expo modules (`expo-clipboard`, `expo-localization`, `expo-linking`, `expo-secure-store`, `expo-notifications`)
  over third-party or web-only libraries.
- Install with `pnpm exec expo install <pkg>`, never `pnpm add`, so versions match the SDK.
- A web-only npm package (one that touches the DOM) is not allowed in `apps/app` unless it sits behind a
  `.web.ts` seam with a native counterpart planned.
- Never create or edit `ios/` or `android/` by hand. Native config goes in `app.json` / config plugins (Continuous
  Native Generation).

**Navigation and deep links.**
- Expo Router only. Every file in `src/app` is a route; nothing else lives there.
- Routes are deep-linkable by design: a screen must work when opened cold from a URL (`/i/[code]`,
  `/circles/[id]`) with no prior navigation state. Read params with `useLocalSearchParams` and validate them
  (e.g. `normalizeInviteCode`) before acting.
- The invite URL shape `/i/<code>` is a public contract. It becomes a universal link / app link in phase 2.
  Never change it.

**Data and state.**
- Server data lives in TanStack Query only. Don't copy it into `useState` or a store.
- All server calls go through `api` / `unwrap` from `src/lib/api.ts`, typed from the generated client.
- After a mutation, invalidate every query that shows the changed data, not just the current screen's.
- Every async surface shows loading, error (with retry) and empty states (`src/ui/States.tsx`). Network failure
  must be a readable state, never a blank screen. On a phone it will happen often.
- Assume the app can be backgrounded or killed at any point. Nothing important may live only in memory.

**Secrets and tokens.**
- When real auth lands (step 0.7), session tokens go in `expo-secure-store` on native (Keychain/Keystore) and in an
  httpOnly cookie or equivalent on web, behind one `src/lib/session` seam. Never plain `storage`,
  AsyncStorage or `localStorage`.
- Nothing secret in `EXPO_PUBLIC_*` variables. They are compiled into the bundle and readable by anyone.

**Layout.**
- Design for phone width first (about 390 px), then check desktop (content max width `maxContentWidth` = 640).
- Respect safe areas (`src/ui/Screen.tsx` uses `react-native-safe-area-context`).
- Touch targets at least 44×44.
- Text must survive Armenian and Russian strings being about 30–40 % longer than English, and large system font
  sizes.
- Light and dark themes both come from `palette` in `theme.ts`.

## The API (`apps/api`), seen from a phone

Installed apps keep calling the API for months after a release (ADR 0003). The API is therefore a public contract:
- **Never break `/v1`.** Don't rename or remove fields, change types, or tighten validation on existing routes.
  Adding optional fields and new routes is fine. A breaking change needs a `/v2` route while old apps are still in
  use.
- **Migrations are additive first** (ADR 0004). Old app versions keep hitting the new schema.
- **Responses are mobile-friendly.** One request per screen where reasonable, no huge payloads, and stable error
  codes the app can switch on (`{ error: { code, message, details } }`).
- **No cookie-only or browser-only assumptions** in API auth. Native clients send headers.
- **Times are UTC ISO strings plus the circle's IANA `timeZone`.** The client formats them with `Intl` in that
  zone. Never send preformatted local strings.

## Shared code

- Business rules live in `packages/domain` (pure, no I/O, no React, no Node APIs), so the app, the API and future
  native code all run the same rule. If you're about to write a rule in a screen or a route handler, it belongs
  in domain.
- `packages/domain`, `packages/i18n` and `packages/api-client` must stay platform-neutral: no `fs`, no `process`
  in runtime code, no DOM, no Node-only crypto (use `globalThis.crypto`, as `invite.ts` does).
- Text comes only from `@krug/i18n`, in all three languages in the same change.

## Review checklist for any app diff

- [ ] No DOM element or browser global in `src/app` / `src/ui`.
- [ ] Any new platform-specific code sits behind a `src/lib` seam.
- [ ] New packages were installed with `expo install` and work on native (or sit behind a seam).
- [ ] The screen works when opened cold from its URL.
- [ ] Loading, error and empty states exist.
- [ ] No business rule was re-implemented in the app.
- [ ] No breaking change to `/v1` or to the `/i/<code>` link.
