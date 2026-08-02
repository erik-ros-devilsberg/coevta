---
story: Strip the frontend — Laravel API + landing page only
created: 2026-08-02
---

## Outcome (2026-08-02)

Delivered, with one deliberate deviation: the sprint was cut to **remove-only**, so the
static `public/reset-password.html` proposed below was **not** built and no new tests were
added. `/reset-password` returns `404` alongside `/login`; a client must own that page and
`FRONTEND_URL` must point at it. The web surface is one route (`GET /`). See "Frontend
removed" in `docs/system.md`.

## Description

The Vue frontend experiment has failed. This repo goes back to what is worth keeping: a
standalone Laravel REST backend for contacts, events and tasks, plus a single static
landing page. Everything Vue — the legacy SPA, the three PWAs, and the whole Node/Vite
toolchain that builds them — comes out.

After this story, `resources/` holds no JavaScript, there is no `package.json`, and
`routes/web.php` serves exactly one thing: `/` → `public/landing.html`. Consumers talk to
the API; whatever UI they want is their problem, in their repo.

The API itself does not change. No controller, model, migration, FormRequest, Resource or
API route is touched by this story. If an API test needs editing, something has gone wrong.

### What goes

- **SPA source** — `resources/spa/` (Vue 3 + vue-router: `main.js`, `App.vue`, `router.js`,
  auth views, `DashboardView`, `components/NavBar.vue`, `lib/passwords.js`, `lib/month.js`).
- **PWA source** — `resources/pwa/contacts/`, `resources/pwa/tasks/`, `resources/pwa/calendar/`.
- **Shared frontend code** — `resources/shared/` (`lib/api.js`, `auth.js`, `kv.js`,
  `outbox.js`, `sync.js`, `store.js`, `datetime.js`, the three resource clients,
  `components/ConfirmDialog.vue`). Nothing else imports it once the apps are gone.
- **Vite entries that only existed for the frontend** — `resources/js/app.js`,
  `resources/css/app.css` (both are stubs), and the empty `resources/views/`.
- **Build configs** — `vite.config.js`, `vite.contacts.config.js`, `vite.tasks.config.js`,
  `vite.calendar.config.js`, `vitest.config.js`.
- **Node toolchain** — `package.json`, `package-lock.json`, `node_modules/` (vue,
  vue-router, vite, vitest, @vue/test-utils, jsdom, concurrently).
- **Built and committed app assets** — `public/spa/`, `public/app.html`,
  `public/contacts/`, `public/tasks/`, `public/calendar/` (shells, `manifest.webmanifest`,
  `sw.js`, placeholder icons, built `app.js`), and the stale `public/build/` Vite output.
- **Web routes** — `/login`, `/dashboard`, `/reset-password`, `/password-reset-complete`
  and the `$pwaShell` catch-alls for `/contacts`, `/tasks`, `/calendar`.
- **Frontend serving tests** — `SpaServingTest`, `ContactsPwaServingTest`,
  `ContactsPwaManifestTest`, `TasksPwaServingTest`, `TasksPwaManifestTest`,
  `CalendarPwaServingTest`, `CalendarPwaManifestTest`, and every `*.test.js` under
  `resources/`.
- **npm steps in composer scripts** — `npm install` / `npm run build` in `setup`, and the
  vite watchers plus `concurrently` in `dev`.

### What stays

- The whole Laravel API: models, migrations, controllers, FormRequests, Resources,
  `routes/api.php`, Sanctum auth, password-reset endpoints, `coevta:create-token`.
- Every API and auth feature test, unchanged.
- `public/landing.html` and the central CSS in `public/css/` (`main.css` and its five
  parts). These are hand-written and self-contained — no Vite, no font manifest, no build
  step. Confirm nothing under `public/css/` references `/build/` or `/spa/` before
  deleting those directories.
- The PHP quality toolchain: PHP-CS-Fixer, PHPStan, PHPUnit, coverage gate, audit,
  `bin/gates.sh`, `composer gates`.

### The one real dependency: password reset

`AppServiceProvider::boot()` builds recovery-email links as
`{app.frontend_url}/reset-password?token=…&email=…`, and that page lived in the SPA. Delete
the SPA blindly and every reset email points at a 404. `PasswordResetApiTest` covers the
URL shape, so this fails loudly rather than silently — good, but it needs a decision, not a
test edit.

Preferred resolution: **keep the reset page as a static page, no framework.** Add
`public/reset-password.html` in the same hand-written style as `landing.html`, with a small
inline `<script>` that reads `token` and `email` from the query string and posts them to
`POST /api/v1/reset-password`. Route `/reset-password` to it the same way `/` is routed.
That preserves the flow, costs ~40 lines of vanilla JS, and adds no toolchain. The
"request a link" form (`POST /api/v1/forgot-password`) can live on the same page when no
token is present.

The alternative — point `FRONTEND_URL` at an external client and let it own the page — is
cheaper still but leaves a self-hosted install with a broken reset flow out of the box.
Decide at shape time; the acceptance criteria below assume the static page.

### Landing page

The CTA currently reads "Log in" and points at `/login`, which will no longer exist.
Repoint it at something real — the API docs, the README, or the GitHub repo — and reword
it. `LandingPageTest` asserts the link contains `login`, so that assertion changes with it.

## Acceptance Criteria

- No Vue, Vite, vitest or Node dependency remains in the repo: `resources/spa`,
  `resources/pwa`, `resources/shared`, `resources/js`, `resources/css`, `resources/views`,
  all `vite*.config.js`, `vitest.config.js`, `package.json`, `package-lock.json` and
  `node_modules/` are gone. A repo-wide grep for `vue`, `vite` and `vitest` returns nothing
  outside `vendor/` and documentation history.
- `public/` contains only `index.php`, `favicon.ico`, `robots.txt`, `landing.html`,
  `reset-password.html` and `css/`. `public/spa`, `public/app.html`, `public/build`,
  `public/contacts`, `public/tasks` and `public/calendar` are removed.
- `routes/web.php` defines exactly two routes: `GET /` → `landing.html` and
  `GET /reset-password` → `reset-password.html`. No `login`, `dashboard`,
  `password-reset-complete`, `contacts`, `tasks` or `calendar` web route exists.
- `GET /` returns `200` HTML, shows the wordmark, loads `/css/main.css`, and its CTA points
  at a URL that resolves.
- `GET /login`, `GET /dashboard`, `GET /contacts`, `GET /tasks`, `GET /calendar` all return
  `404` — asserted by a feature test, so a stray route can't quietly come back.
- `GET /reset-password` returns `200` HTML and the page posts to `/api/v1/reset-password`.
  `PasswordResetApiTest` still passes unmodified: the emailed link keeps its
  `{frontend_url}/reset-password?token=…&email=…` shape.
- Every API endpoint behaves exactly as before: `/api/v1` contacts, events, tasks, login,
  logout, user, forgot-password and reset-password tests pass **without a single
  assertion being changed**.
- The frontend-only test files listed above are deleted; no PHP test references
  `app.html`, `/spa/app.js`, `sw.js` or `manifest.webmanifest`.
- `composer setup` works on a clean clone with no Node installed — no `npm install`, no
  `npm run build`. `composer dev` starts the server (and queue listener) with no vite
  watchers and no `concurrently`.
- `.gitignore` drops the dead frontend entries (`/node_modules`, `/public/build`,
  `/public/spa`, the per-PWA `app.js` / `app.css` rules).
- `README.md` and `CLAUDE.md` describe an API-only project with a static landing page — no
  Vue, no PWA, no npm commands. The CSS conventions section stays: `public/css/` is still
  how the landing page is styled.
- `docs/system.md` replaces its "Frontend (static landing + Vue SPA)", "The PWAs
  (offline-first apps)", "Offline data layer" and "Per-app specifics" sections with a short
  record of what was removed and why, and the new two-route web surface. The removal is
  documented as a deliberate decision, not a gap.
- `composer gates` passes: PHP-CS-Fixer, PHPStan max, PHPUnit, coverage ≥ 90%, audit.
  Coverage must not be met by deleting tests that still have production code behind them.

## Out of scope

- Any change to API behaviour, routes, payloads or validation.
- Rehoming the deleted Vue apps into another repo. If they are worth salvaging, that is a
  separate repo and a separate story — this one deletes them here.
- Rebuilding a UI in any other technology.
- Redesigning the landing page beyond fixing the dead CTA.
