# Pytra Web

Frontend for **Pytra**, a personal video game tracking app. One Angular codebase ships as a web SPA and as an Android app (Capacitor).

| | |
|---|---|
| Live app | https://pytra.up.railway.app |
| API | https://pytra-api-production.up.railway.app |
| Backend repo | [EstebanMM13/pytra-api](https://github.com/EstebanMM13/pytra-api) (Spring Boot) |

## Quick start

```bash
npm ci
npm start          # ng serve on http://localhost:4200
```

> By default the dev server talks to the **production API**, because the API origin is hard-coded (see [Configuration](#configuration)).

## Features

| Area | What you can do |
|---|---|
| Auth | Register, mandatory email verification (with resend), login with username or email, forgot/reset password, Google login |
| Dashboard | Stats summary, hours by year/saga/genre, top-rated playthroughs, most-played singleplayer and online games |
| Library | Games (cover image URL, saga, genres), sagas, genres created on the fly |
| Playthroughs | Log, edit and delete experiences per game; track online playtime |
| Steam | Link a Steam account, sync the library, review and confirm pending games |
| Profile | View account info and change username |

The UI text is in Spanish, served through ngx-translate (`public/i18n/es.json`). An `en.json` file exists, but there is no language switcher yet.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Angular 22.2 (standalone components, lazy-loaded routes) |
| Language | TypeScript 6.0 |
| Styling | Tailwind CSS 4 (via PostCSS) |
| i18n | @ngx-translate/core 18 |
| Mobile | Capacitor 8.5 (Android), `@capacitor/app`, `@capacitor/browser` |
| Tests | Vitest 5 + jsdom (through `ng test`) |
| Serving | nginx 1.27 (Docker), Node 24 build stage |

## Project structure

```
src/app/
├── core/                 # Cross-cutting, no UI
│   ├── api-base-url.ts   # API origin
│   ├── guards/           # authGuard, guestGuard
│   ├── interceptors/     # Adds the JWT to API requests
│   ├── models/           # API DTO types
│   ├── services/         # One service per API resource, auth, token storage, native OAuth bridge
│   └── validators/       # Username rules (mirror the API)
├── features/             # Routed pages
│   ├── auth/             # login, register, verify-email, forgot/reset-password, oauth-callback
│   ├── dashboard/
│   ├── games/            # list, game detail, experience form and detail
│   ├── sagas/            # list, saga detail
│   ├── steam/
│   └── profile/
└── shared/               # navbar, resend-verification
```

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Dev server (`ng serve`) |
| `npm run build` | Production build to `dist/pytra-web/browser` |
| `npm run watch` | Development build in watch mode |
| `npm test` | Unit tests (`ng test`, Vitest) |

## Configuration

| Setting | Where | Value |
|---|---|---|
| API origin | `src/app/core/api-base-url.ts` | `https://pytra-api-production.up.railway.app` (hard-coded) |
| API in CSP | `nginx.conf.template` (`connect-src`) | Same origin as above |
| App id / deep-link scheme | `capacitor.config.ts`, `android/app/build.gradle`, `AndroidManifest.xml` | `com.estebanmm13.pytra` |
| OAuth deep link | `AndroidManifest.xml`, `core/services/native-oauth.service.ts` | `com.estebanmm13.pytra://oauth-callback` |

**Using a local API:** temporarily set `API_ORIGIN` in `api-base-url.ts` to `http://localhost:8080`. The API's default CORS and `FRONTEND_URL` already allow `http://localhost:4200`. If you change the origin for a deployed build, update `connect-src` in `nginx.conf.template` too.

The JWT is stored in `localStorage` and sent by the auth interceptor.

## Build for production (Docker + nginx)

The `Dockerfile` builds the app with Node 24 and serves `dist/pytra-web/browser` with nginx, listening on `$PORT` (default `8080`).

```bash
docker build -t pytra-web .
docker run -p 8080:8080 pytra-web
```

`nginx.conf.template` provides:

- **SPA fallback:** unknown routes serve `index.html` (`Cache-Control: no-cache`).
- **Long caching** for content-hashed `.js`/`.css` (`1y`, `immutable`).
- **Security headers** on every response: `Content-Security-Policy` (`script-src 'self'`, `frame-ancestors 'none'`, API-only `connect-src`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`.
- gzip for text assets.

Critical CSS inlining is disabled in `angular.json` so the build emits no inline scripts and the strict `script-src` holds.

## Android app

Requirements: Android SDK (min SDK 24, target SDK 36) and a JDK for Gradle.

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**How login works on Android:** Google rejects OAuth in embedded WebViews, so Google login and Steam linking open in a Custom Tab with `client=android`. The API finishes by redirecting to `com.estebanmm13.pytra://oauth-callback?code=...`; the app catches that deep link, closes the tab and routes to `/oauth-callback`, which exchanges the one-time code for a JWT. On the web, the same flows use a normal full-page redirect.

The Android WebView origin is `https://localhost`, which the API allows in CORS by default.

## Deployment (Railway)

The web app runs as the `pytra-web` service on Railway, built from the `Dockerfile`. There is no GitHub auto-deploy; deploy manually from this directory:

```bash
railway up --service pytra-web --environment production --detach
```

## Known limitations

- **Hard-coded API origin:** `ng serve` uses the production API unless you edit `api-base-url.ts`. There are no Angular environment files.
- **Debug APK only:** there is no release signing configuration.
- **Single UI language:** Spanish only, no language switcher.
