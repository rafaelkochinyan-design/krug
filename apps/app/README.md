# @krug/app

Expo (React Native) client. Today it ships as a web app; the same code becomes the iOS and Android apps in phase 2.

```bash
cp .env.example .env.local   # API URL and test mode
pnpm dev                     # then press w for web
pnpm build                   # static web build in dist/
```

- Screens live in `src/app/` (Expo Router: every file is a route). Everything else lives outside it:
  `src/ui` (design tokens and components), `src/lib` (API client, i18n, storage, formatting).
- Components take colors only from `src/ui/theme.ts`.
- All text comes from `@krug/i18n`; a missing or misspelled key fails `tsc`.
- All server calls go through `api` from `src/lib/api.ts`, typed from the API's OpenAPI document.
- Install native-capable packages with `pnpm exec expo install <pkg>` so versions match the SDK.
