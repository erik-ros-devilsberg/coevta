
# System Documentation

This file is maintained by `/agile:wrap-sprint`. Read this to understand the system without reading all the code.

## Foundation decisions (locked)

These were decided in the Project Foundation sprint and apply to every later feature:

- **Framework**: Laravel 13 (PHP 8.4), minimalist skeleton structure (no HTTP Kernel; `bootstrap/app.php` configures routing/middleware/exceptions).
- **IDs**: domain entities use **UUID v7** string primary keys via `App\Models\BaseModel` (which uses `App\Models\Concerns\HasUuidV7`, a thin wrapper over Laravel's `HasUuids` → `Str::uuid7()`). Entity models extend `BaseModel`. The `users` table keeps Laravel's default auto-increment id (it is infrastructure, not a domain entity).
- **API prefix / versioning**: all routes under `/api/v1` (the `/api` prefix comes from `bootstrap/app.php`; the `v1` segment from a route group in `routes/api.php`).
- **Auth**: Laravel **Sanctum** token auth. Protected routes use the `auth:sanctum` middleware. Tokens are minted via the `coevta:create-token {email}` artisan command (creates the user if absent) — the minimal "standard user" path until a full user-management story exists.
- **Soft deletes**: off. `DELETE` removes rows permanently.
- **Per-user ownership**: every domain entity (contacts, events, tasks) belongs to a
  user. Each has a non-nullable `user_id` FK to `users.id` (`foreignId('user_id')
  ->constrained()->cascadeOnDelete()` — deleting a user removes their records). `user_id`
  is set from the authenticated user (`$request->user()`), **never** from the request body
  (it is not `$fillable`; it is set implicitly via the owning relation on create — a
  `user_id` in the body is ignored). `user_id` is **never serialized** in API responses.
  Enforcement is **explicit controller scoping** (not a global scope): every controller
  action queries through `$user->{relation}()` (`index`/`store`/`show`/`update`/`destroy`
  + tasks `complete`), so a record owned by another user is **not found** (`404`), never
  `403` — we do not reveal that it exists. Entity models declare `belongsTo(User)`; `User`
  declares `hasMany` `contacts()`/`events()`/`tasks()`.
- **Pagination**: Laravel default paginator, 25 per page (applied per-resource in later stories).
- **Database**: MariaDB. Dev DB `coevta`; test DB `coevta_test` (configured in `phpunit.xml`). Connection driver: `mariadb`.

## REST & API conventions (all entities)

- JSON in, JSON out (`Content-Type: application/json`).
- Resource routes: `index` (GET collection), `show` (GET one), `store` (POST), `update` (PUT/PATCH), `destroy` (DELETE).
- Validation in `FormRequest` classes; responses via API `Resource` classes; controllers stay thin.
- **Error envelope** (JSON, gated to `api/*` paths via `shouldRenderJsonWhen` in `bootstrap/app.php`):
  - `422` validation — `{ "message": ..., "errors": { field: [...] } }`
  - `404` not found — `{ "message": ... }`
  - `400` bad request — `{ "message": ... }`
- Timestamps serialized as RFC 3339 / ISO 8601 UTC (trailing `Z`) — Google-compatible. See `HealthController` for the canonical format.

## Quality tooling

- **`composer gates`** — runs every gate below in one pass (`bin/gates.sh`): style verify, PHPStan, tests, coverage (auto-skipped without a driver), audit. Runs all gates even on failure; exits non-zero if any fail. **Run this before committing.**
- **PHPUnit** — tests under `/tests`; `composer test`.
- **PHPStan / Larastan** at **max** level, zero errors; `composer stan` (`phpstan.neon` analyses `app`, `database`, `routes`).
- **PHP-CS-Fixer** — `@PSR12` with **tab** indentation (`->setIndent("\t")`); `composer fix` / `composer fix:check`.
- **composer audit** — clean.
- **Coverage** — `composer coverage` runs PHPUnit with clover output and `bin/coverage-check.php` enforces a **90%** line-coverage minimum (requires a pcov/xdebug driver). Currently at **100%**.
- **Frontend** — `npm run build` (Vite) builds **every app** (legacy SPA + each PWA, one config
  per app); `npm test` runs **Vitest** (`vitest run`, jsdom env — config in `vitest.config.js`)
  over `resources/**/*.test.js`, which spans all three source trees: `shared/`, `spa/` and
  `pwa/`. Two layers: **lib unit tests** (`lib/*.test.js` — API client behaviour, payload
  shapes, datetime/month helpers, storage contract, outbox/sync logic, `401`/`422` paths) and
  **component tests** (`views/*.test.js` — `@vue/test-utils` mounting a view, mocking the
  `lib`/`vue-router` modules, asserting calls + rendered state, e.g. `LoginView` auth flow,
  `TasksView` quick-add/complete, offline create/edit/delete). The JS suite is **not** part of
  `composer gates` — run `npm test` alongside it.

## Authentication & login

Auth is **API-token only** (Sanctum). There is **no web/session login** — the browser
login form is part of the Vue SPA and authenticates against the API like any other client.
(`UserFactory` default password is `password`.)

- **Login** (`POST /api/v1/login`) returns a Sanctum personal access token
  (`$user->createToken()`), the same model the `coevta:create-token` command mints. The SPA
  stores it client-side (localStorage) and sends it as a bearer token; `POST /api/v1/logout`
  revokes the current token.
- **Password recovery** (`POST /api/v1/forgot-password`, `POST /api/v1/reset-password`) is
  built on Laravel's `Password` broker against the stock `password_reset_tokens` table
  (`App\Http\Controllers\PasswordResetController`). Key behaviours:
  - **No account enumeration** — `forgot-password` always returns the same success-shaped
    response whether or not the email exists; no notification is sent for unknown emails.
  - Tokens are single-use and expire after 60 min (`config/auth.php` `passwords.users`).
    Invalid/expired/wrong-email tokens → `422`, password unchanged.
  - New password policy: `min:8`, `confirmed`.
  - **On a successful reset all of the user's Sanctum tokens are revoked**
    (`$user->tokens()->delete()`), so a leaked password cannot keep live sessions alive.
  - The reset link in the email points at the **frontend** (SPA), not the API:
    `ResetPassword::createUrlUsing` (in `AppServiceProvider`) builds
    `{config('app.frontend_url')}/reset-password?token=…&email=…`; `app.frontend_url`
    defaults to `APP_URL` (env `FRONTEND_URL`). The SPA reset view reads those query params
    and posts them to `reset-password`.

Auth is deliberately **exempt from the "minimize computer says no" principle**: wrong
credentials must fail (never defaulted). Error messages are generic and do not reveal
whether an email is registered. Login and both recovery endpoints are rate-limited
(`throttle:6,1`). There is no registration yet — users come from `coevta:create-token`
(or a future user-management story).

## Frontend (static landing + Vue SPA)

**There is no server-side rendering.** The backend is API-only; the frontend is static.
Blade has been removed (no `resources/views`). `routes/web.php` only streams static HTML
files (`response(file_get_contents(...))`, never `view()`).

- **Landing** — `GET /` (`home`) serves the static `public/landing.html`. Public marketing
  page; CTA links to `/login`.
- **App (Vue SPA)** — `GET /login` (`login`), `/dashboard` (`dashboard`), `/calendar`
  (`calendar`), `/reset-password` (`password.reset`) all serve the same static shell
  `public/app.html`. **`/contacts` and `/tasks` are no longer among them** — each is its own
  PWA (see below), and the NavBar links to them are plain `<a href>` full page loads out of
  the SPA. **Calendar is the only module still living in the SPA**; when it moves, the SPA can
  be deleted — but `/login` and `/reset-password` must be rehomed first, because password
  reset emails link to `/reset-password` (see Authentication & login). The SPA's client-side router (history mode) renders the right view, so
  deep links resolve instead of 404ing. Auth is enforced **client-side** (`requiresAuth`
  routes bounce tokenless users to `/login`); the server never 302s guests. **Every new SPA
  route needs both a router entry and a `routes/web.php` shell route** (covered by
  `SpaServingTest`).

**SPA source** lives in `resources/spa/` (Vue 3 + vue-router):
- `main.js` → `App.vue` → `router.js`.
- **Auth views**: `LoginView`, `ResetPasswordView` (the reset view shows the "choose a new
  password" form when the URL carries a token, else a "request a link" form) — centred,
  no nav.
- **App shell**: authenticated views wrap their content in `<NavBar>` (`components/NavBar.vue`
  — wordmark + Calendar/Contacts/Tasks links + Log out) inside `.app`/`.app-main`.
  `resources/shared/components/ConfirmDialog.vue` provides the confirm-delete modal — it lives
  in `shared/` because the PWA needs it too, and two copies would drift apart. These are reused
  by all modules.
- **Module views**: `DashboardView` (home);
  `CalendarView` (a single Monday-first month grid — prev/next/today, event chips with timed
  vs all-day styling, click a day to create / a chip to edit, confirm-delete). Because the
  Events API has no date filter, the calendar fetches **all** events (`listAllEvents` pages
  through) and groups them onto days client-side.
- `lib/` is the testable, framework-free core. The app-agnostic parts now live in
  `resources/shared/lib/` — `api.js` (bearer-token JSON client; token in localStorage with an
  in-memory fallback; clears token on `401`), `auth.js` (login/logout/currentUser) and
  `contacts.js` (list/get/create/update/remove + `listAllContacts`) — imported by both the SPA
  and the PWAs, along with `tasks.js` (CRUD + `completeTask` + `listAllTasks` +
  `buildTaskBody`) and `datetime.js` (date/datetime helpers — keeps date-only vs datetime
  granularity, `localDateKey` for day mapping, shows datetimes in local time, sends/stores
  ISO 8601 UTC); there is exactly one of each in the repo. SPA-only modules stay in
  `resources/spa/lib/`: `passwords.js` (requestReset/resetPassword),
  `events.js` (CRUD + `listAllEvents`), `month.js` (pure UTC-based month-grid helpers —
  `monthMatrix`/`groupByDay`/`shiftMonth`). **Convention**: each module gets a thin
  `lib/<resource>.js` over `apiFetch`, unit-tested with Vitest; views handle `401` by
  redirecting to `/login` and `422` by mapping `err.data.errors` onto fields.

**Build & serving.** Vite (`@vitejs/plugin-vue`) builds `resources/spa/main.js` to
`public/spa/app.js` with a **stable (unhashed) filename**, so the committed shell
`public/app.html` references `/spa/app.js` directly — no manifest, no `@vite`, no Blade.
`public/spa/` is a build artifact (gitignored); `npm run build` (run by `composer setup`)
produces it.

## The PWAs (offline-first apps)

Each resource ships as a **standalone installable PWA**, separate from the legacy SPA.
**Contacts** (`/contacts/`) and **Tasks** (`/tasks/`) exist; **Calendar** (`/calendar/`) is
still in the legacy SPA and follows, at which point the SPA can be deleted. The backend is
unchanged — the PWAs are just API clients.

**Why separate apps rather than one SPA.** A service worker's scope is bounded by its
path, and a navigation outside that scope drops an installed app back into a browser tab.
So each app is self-contained under its own prefix — including **its own login view**
(`/contacts/login`), rather than sharing the SPA's `/login`. Apps share an origin, so the
Sanctum token in localStorage is shared: log in once, all apps are authenticated.

- **Source**: `resources/pwa/<app>/` (`contacts`, `tasks`). **Shared, app-agnostic code**:
  `resources/shared/` (`lib/api.js`, `lib/auth.js`, `lib/kv.js`, `lib/outbox.js`,
  `lib/sync.js`, `lib/store.js`, `lib/datetime.js`, the resource clients `lib/contacts.js` /
  `lib/tasks.js`, and `components/ConfirmDialog.vue`) — imported by the PWAs and the legacy
  SPA. There is exactly one of each in the repo.
- **Build**: one Vite config per app (`vite.contacts.config.js`, `vite.tasks.config.js`; root
  `resources/pwa/<app>`, `emptyOutDir: false` because committed static files share the output
  directory). `npm run build` builds every app. Output `public/<app>/app.js`, stable/unhashed
  and gitignored.
- **Static, committed**: `public/<app>/index.html` (shell), `manifest.webmanifest`,
  `icon.svg`, `icon-maskable.svg`, `sw.js`. Icons are **placeholders** — branding is a
  separate sprint. They are SVG, which satisfies Chromium installability but **not iOS**,
  which wants PNG.
- **Serving**: `/<app>` + `/<app>/{any}` serve that app's shell (`routes/web.php`, via the
  shared `$pwaShell` factory). The `[^.]*` route constraint keeps the catch-all off anything
  with a file extension, so the real files above are served by the web server rather than
  swallowed by PHP — asserted by `ContactsPwaServingTest` / `TasksPwaServingTest`.
- **Service worker**: hand-written per app (the bundles have stable names, so each precache
  list is literal). Cache-first shell; `activate` deletes only that app's older caches
  (`coevta-contacts-*`, `coevta-tasks-*`) — a broader prefix would wipe a sibling app's shell.
  **`/api/*` is never cached** — API data belongs to the offline layer, not the HTTP cache.
  **Maintenance**: adding a shell asset means adding it to `SHELL` *and* bumping `CACHE`;
  `addAll` is atomic, so a stale entry fails the whole install. `main.css` only `@import`s
  its parts, so every part is precached individually (pinned by the manifest tests). The
  `/css/*` parts are shared by every app, so **a CSS change means bumping the cache version
  in every app's worker**, not just the one being worked on.

### Offline data layer

Reads and writes both go to the device first; the network is a background concern.

**The whole layer is resource-agnostic and lives in `resources/shared/lib/`.** Operations
carry a `recordId` and an opaque `payload`; a per-app store supplies its remote, its storage
names and its ordering. There is **one outbox and one sync engine in the repo** — an app's
`lib/store.js` is a dozen lines of wiring.

- **Storage** (`shared/lib/kv.js`): a deliberately narrow async key-value interface
  (`get/set/del/all/keys/clear`) with an **IndexedDB** adapter and an **in-memory** one.
  That split is what lets the sync logic be unit-tested without a browser IndexedDB (no
  `fake-indexeddb` dependency). `createKv` falls back to memory where IndexedDB is absent
  rather than throwing. The IDB adapter holds no logic and is not unit-tested. **Each app
  gets its own database** (`coevta-contacts`, `coevta-tasks`), so caches and queues cannot
  collide.
- **Store** (`shared/lib/store.js`, `createOfflineStore({ kv, outboxKv, remote, sort })`):
  the whole record set lives on the device (`listAllContacts` / `listAllTasks` page through),
  so listing, searching, sorting and the A–Z scrubber are all client-side — **there is no
  pagination UI**. `refresh()` reconciles with the server but **skips records with pending
  changes** in both directions: otherwise it would overwrite an offline edit with the
  server's stale copy, or delete an offline-created record the server has never heard of.
  `update()` takes a **complete body** — the API's PUT is a full replacement, so a partial
  payload wipes fields when it eventually syncs.
- **Outbox** (`shared/lib/outbox.js`): a durable, ordered queue (monotonic `seq`, sequence
  derived from storage so restarts continue rather than replay). Coalescing at enqueue:
  create+delete cancels both; update+update keeps the last; update folds into a pending
  create (an update against an unsynced id would 404); delete drops a pending update.
- **Sync** (`shared/lib/sync.js`): `flush()` is **serialized** (start-up and the `online`
  event routinely fire together). Per-operation failure policy: **401** stops and keeps the
  queue for after re-auth; **404** drops the op and reconciles locally; **422** drops the op
  and reports it (a poison op must never wedge the queue); anything else is transient — stop
  and retry next flush, preserving order.
- **Temporary ids**: records created offline get a `local-` id and appear immediately.
  When the create syncs, the server's record replaces it and `remapRecordId` repoints any
  queued ops at the real id. Operations are flagged `sending` before the request leaves, and
  coalescing skips those — **folding an edit into an already-sent create would silently
  drop it**. The contacts form returns to the list after create, since the temp id is about
  to change.

**Conflict resolution is last-write-wins, and this loses data by design.** Two devices
editing the same contact offline means the later sync silently overwrites the earlier. The
Contacts API exposes no version, ETag or `updated_at`, so a client cannot detect that a
record changed underneath it, and the backend is fixed. Related: a create whose response is
lost (network drop after the server committed) will be resent and **duplicate the record** —
the API has no idempotency key. Both are accepted, documented trade-offs of keeping the
backend unchanged, not oversights.

### Per-app specifics

**Contacts** (`resources/pwa/contacts/`) — list, detail and form views; ordering and grouping
come from `lib/alphabet.js`, which also drives the bottom-pinned A–Z scrubber (accent- and
case-insensitive, `#` bucket for names that do not start with a letter).

**Tasks** (`resources/pwa/tasks/`) — a single list view: quick-add, Open/Completed split,
complete/reopen toggle, edit-in-modal and confirm-delete, so there is no detail or form route
to deep-link to. `lib/ordering.js` sorts open tasks first (soonest due date, undated last,
ties by title) and completed tasks below, most recently completed first; `isOverdue` marks an
open task whose due date has passed. `due_at` may be date-only or a datetime and both shapes
appear in the same list, so ordering compares them via `Date.parse`.

**Completion is client-stamped, and this is the one place a PWA deliberately ignores an API
endpoint.** `POST /tasks/{id}/complete` stamps `completed_at` server-side, which offline
would record the moment the queue happened to drain — possibly days after the user ticked the
box. So `store.complete(task)` is an ordinary update carrying `completed_at` from the device
clock, and behaves identically online and offline. The endpoint remains in the API for other
clients but **has no frontend consumer**. The cost is that a skewed device clock stamps a
skewed time and last-write-wins cannot detect it.

**The sharpest failure mode in the tasks app is a task silently reopening.** The API's PUT is
a full replacement, so any queued update that omits `completed_at` clears it server-side. That
is why `buildTaskBody` always returns every field, the store's complete/reopen build their
body from the whole task, and the edit view carries `completed_at` through unchanged. It is
covered by tests at every layer (outbox coalescing, sync payload, store round trip, and the
edit view).

## Styling (Devilsberg brand, dark theme)

Hand-written CSS (no Tailwind), centrally located and **split by function** under
`public/css/`, mirroring the sibling-project convention (archivus, devilsberg-com). A single
entry `main.css` `@import`s, in cascade order: `tokens.css` → `base.css` → `layout.css` →
`components.css` → `utilities.css`. Both the static landing and the SPA shell link
`/css/main.css` — one source for both.

- **Brand**: Devilsberg dark — Onyx (`#0a0a10`) canvas, Ghost White (`#f7f7ff`) text, Blue
  Slate borders/labels, Hot Fuchsia accents/errors, Sea Green for primary-button hover. All
  tokens (colours + `--font-title`/`--font-body`) live in `tokens.css`; no hardcoded hex
  elsewhere.
- **Type**: headings Lemon Milk (`@font-face`, falls back to `sans-serif` — the brand font
  file is not vendored, so a **text wordmark** stands in for the logo); body Open Sans (Bunny
  CDN `@import`).
- Components: `.btn`/`.btn--primary`/`.btn--ghost`/`.btn--sm`, `.form`/`.field`/`.error`,
  `.wordmark`, plus the app-shell patterns `.nav`, `.list`/`.list__row`, `.toolbar`,
  `.modal`, `.field__error`, `.app-main`; visible focus affordance; single-column at
  `max-width: 768px`.

## Endpoints (so far)

- `GET /api/v1/ping` — public liveness check, returns `{ status: "ok", version: <from version.json via config('coevta.version')>, time: <ISO8601 UTC> }`.
- `POST /api/v1/login` — public; `{ email, password }` → `200 { token }`; bad creds `401` (generic message, no token); missing fields `422`. `throttle:6,1`.
- `POST /api/v1/forgot-password` — public; `{ email }` → `200` (same response for known/unknown emails, no enumeration). `throttle:6,1`. See Authentication & login.
- `POST /api/v1/reset-password` — public; `{ email, token, password, password_confirmation }` → `200`; invalid/expired token or `min:8`/`confirmed` failure → `422`. Revokes the user's existing tokens on success. `throttle:6,1`.
- `GET /api/v1/user` — returns the authenticated user (requires `auth:sanctum`).
- `POST /api/v1/logout` — `auth:sanctum`; revokes the current access token, returns `204`.

### Contacts (`auth:sanctum`)

Google People-compatible contact records. Full CRUD; **update is PUT-only** (full replacement) — `PATCH` returns `405`.

- `GET /api/v1/contacts` — paginated collection (25/page).
- `POST /api/v1/contacts` — create; `201` with the resource. `display_name` required.
- `GET /api/v1/contacts/{id}` — one contact; `404` if unknown.
- `PUT /api/v1/contacts/{id}` — full replacement; `404` if unknown.
- `DELETE /api/v1/contacts/{id}` — `204`; `404` if unknown.

**Model** (`App\Models\Contact` extends `BaseModel`; UUID v7 id; **no timestamps**):
`id`, `display_name` (required), `given_name`, `family_name`, `email`, `phone`, `organization`, `notes`, `address`, `birthday` (date-only, serialized `YYYY-MM-DD`). No `email` uniqueness. Only fillable fields persist; unknown body fields are ignored. Serialized via `App\Http\Resources\ContactResource`.

### Events (`auth:sanctum`)

Google Calendar-compatible events. Full CRUD; **update is PUT-only** (`PATCH` → `405`). No recurrence, no `status`.

- `GET /api/v1/events` — paginated collection (25/page).
- `POST /api/v1/events` — create; `201`.
- `GET /api/v1/events/{id}` — one event; `404` if unknown.
- `PUT /api/v1/events/{id}` — full replacement; `404` if unknown.
- `DELETE /api/v1/events/{id}` — `204`; `404` if unknown.

**Model** (`App\Models\Event` extends `BaseModel`; UUID v7 id; **no timestamps**):
`id`, `title`, `description`, `location`, `start_at`, `end_at`, `all_day`. Datetimes stored/returned as ISO 8601 UTC (`Z`). Serialized via `App\Http\Resources\EventResource`.

**Forgiving input** (the "minimize computer says no" principle — see CLAUDE.md). Normalization lives in `App\Http\Requests\Concerns\NormalizesEventInput::prepareForValidation()`, shared by store + update. Events are never rejected on these fields:
- `title` → `"Untitled event"` when blank/missing.
- `start_at` → parsed (tz-less assumed UTC, offsets converted to UTC); falls back to now() if unparseable.
- `end_at` → `start_at + 1 hour` when missing or before `start_at`; kept when `== start_at`.
- `all_day` → coerced to boolean; when `true`, `start_at` is snapped to `00:00:00` and `end_at` to `23:59:59` of the end date (same day when `end_at` omitted).
- An empty `POST` body creates a valid event entirely from defaults.

### Tasks (`auth:sanctum`)

Google Tasks-compatible to-do items. Full CRUD; **update is PUT-only** (`PATCH` → `405`). No `status` — completion is `completed_at` alone (`null` = open).

- `GET /api/v1/tasks` — paginated collection (25/page).
- `POST /api/v1/tasks` — create; `201`.
- `GET /api/v1/tasks/{id}` — one task; `404` if unknown.
- `PUT /api/v1/tasks/{id}` — full replacement; `404` if unknown.
- `POST /api/v1/tasks/{id}/complete` — **no body**; stamps `completed_at = now()`, returns `200` + the task. Idempotent. **No frontend calls this**: the Tasks PWA stamps completion from the device clock so it works offline (see The PWAs → Per-app specifics). Kept for other clients.
- `DELETE /api/v1/tasks/{id}` — `204`; `404` if unknown.

**Model** (`App\Models\Task` extends `BaseModel`; UUID v7 id; **no timestamps**):
`id`, `title`, `notes`, `due_at`, `completed_at`. Internal `due_has_time` column (not serialized) records whether `due_at` was given as a date or a datetime. Serialized via `App\Http\Resources\TaskResource`.

**Forgiving input** (`App\Http\Requests\Concerns\NormalizesTaskInput`):
- `title` → `"Untitled task"` when blank/missing.
- `due_at` → accepts **date-only OR datetime**; tz-less assumed UTC, offsets converted; unparseable → `null`. Echoed back in the same granularity (date-only → `YYYY-MM-DD`, datetime → ISO 8601 UTC).
- `completed_at` → datetime in UTC; unparseable → `null`.
- `PUT` is a full replacement: omitting `completed_at` reopens the task.
- An empty `POST` body creates a valid open task.

