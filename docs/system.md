
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
- Resource routes: `index` (GET collection), `show` (GET one), `store` (POST), `update` (PUT), `patch` (PATCH), `destroy` (DELETE).
- Validation in `FormRequest` classes; responses via API `Resource` classes; controllers stay thin.
- **PUT replaces, PATCH updates in part.** `PUT` takes the whole record — every omitted field
  resets to its default (for tasks that means **omitting `completed_at` reopens the task**).
  `PATCH` changes only the keys the body carries; an explicit `null` clears a field, an absent
  key is left alone, and `PATCH {}` is a `200` no-op.
  - **Implementation**: `Patch*Request extends Update*Request` + the
    `MergesPatchIntoStoredRecord` concern. The concern lays the body over the stored record's
    **own JSON shape** (`json_encode`/`json_decode` of the API `Resource`) and the inherited
    rules and normalization then run over the merged whole — so cross-field behaviour is
    identical to `PUT` (event `end_at` follows a moved `start_at`, `all_day` snaps the stored
    bounds, a task's `due_has_time` is re-derived from the merged `due_at`). Encoding through
    the Resource is what keeps Carbon out of the merge (it would parse as null and silently
    reset the record) and what preserves date-only `due_at` granularity.
  - When the record does not exist or belongs to someone else, the patch request returns **no
    rules at all**, so the controller's `findOrFail()` gives the usual `404` instead of a
    misleading `422`.
  - **A date PATCH cannot read is a `422` — a deliberate exception to "minimize computer says
    no"** (`birthday`, `start_at`, `end_at`, `due_at`, `completed_at`). `PUT` still coerces
    garbage to null/`now()`, because there the client sent the whole record; on a partial
    update, wiping or moving a stored date over a typo is the worse outcome. Mechanically the
    concern leaves the unreadable string in place so the inherited `date` rule rejects it.
    `null` and `""` are treated as empty, not garbage, and still clear the field.
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
- **No frontend toolchain** — there is no npm, Vite or Vitest step. `composer gates` is the
  whole story (see "Frontend removed"). A clean clone needs PHP and Composer only.
- **Local run** — `composer setup` (install, `.env`, key, migrate) then `composer dev`,
  which is a plain `php artisan serve --port=8040`. It used to fan out over `concurrently`
  (queue, pail, four vite watchers); that went with the Node toolchain, so **the queue
  listener and `pail` are now separate manual commands** when they are needed.

## Authentication & login

Auth is **API-token only** (Sanctum). There is **no web/session login and no login page** —
a client authenticates against the API like any other consumer.
(`UserFactory` default password is `password`.)

- **Login** (`POST /api/v1/login`) returns a Sanctum personal access token
  (`$user->createToken()`), the same model the `coevta:create-token` command mints. The
  client stores it and sends it as a bearer token; `POST /api/v1/logout` revokes the
  current token.
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
  - The reset link in the email points at a **client**, not the API:
    `ResetPassword::createUrlUsing` (in `AppServiceProvider`) builds
    `{config('app.frontend_url')}/reset-password?token=…&email=…`; `app.frontend_url`
    defaults to `APP_URL` (env `FRONTEND_URL`). Whatever consumes this backend owns that
    page: it reads the query params and posts them to `reset-password`.
  - **This project no longer serves that page.** The SPA that used to own
    `/reset-password` was deleted (see "Frontend removed"), and no replacement was built —
    an accepted consequence, not an oversight. Point `FRONTEND_URL` at a client that
    implements the page, or the emailed link lands nowhere. `PasswordResetApiTest` still
    pins the **shape** of the URL, which is all the backend is responsible for.
  - **Reset is account-level.** One user row and one credential back every client, and a
    reset revokes every token at once, so it signs the user out everywhere.

Auth is deliberately **exempt from the "minimize computer says no" principle**: wrong
credentials must fail (never defaulted). Error messages are generic and do not reveal
whether an email is registered. Login and both recovery endpoints are rate-limited
(`throttle:6,1`). There is no registration yet — users come from `coevta:create-token`
(or a future user-management story).

## Frontend removed (2026-08-02)

**The Vue frontend experiment failed and was deleted.** This repo is the Laravel backend
plus one static landing page — nothing else. The decision is deliberate: a client is
someone else's project, consuming the REST API like any other consumer.

**What the web surface is now.** `routes/web.php` holds exactly **one** route: `GET /`
(`home`) streams `public/landing.html` as HTML (`response(file_get_contents(...))`, never
`view()`). There is no server-side rendering, no Blade, no `resources/` directory at all.
Everything else this project does lives under `/api/v1`.

**What was deleted**, in one sprint:

- The legacy Vue SPA (`resources/spa/`, `public/app.html`, `public/spa/`) and its routes
  `/login`, `/dashboard`, `/reset-password`, `/password-reset-complete`.
- All three PWAs — contacts, tasks and calendar (`resources/pwa/*`, `public/contacts/`,
  `public/tasks/`, `public/calendar/`, including shells, service workers, manifests and
  placeholder icons) and their `/<app>` + `/<app>/{any}` catch-all routes.
- The shared frontend core `resources/shared/` (API client, auth, the offline layer —
  `kv.js`, `outbox.js`, `sync.js`, `store.js` — datetime helpers, resource clients,
  `ConfirmDialog.vue`).
- The whole Node toolchain: `package.json`, `package-lock.json`, `node_modules/`, the four
  Vite configs and `vitest.config.js`; and the npm steps in `composer setup` / `composer dev`.
- Their tests: `SpaServingTest`, the three `*PwaServingTest`, the three `*PwaManifestTest`,
  and every `*.test.js` (the entire Vitest suite).

**Consequences accepted at the time, not defects:**

- **The landing page CTA points at `/login`, which now returns `404`.** Left as-is on
  purpose; rewording it is a separate concern.
- **`/reset-password` no longer exists here.** Recovery emails still carry
  `{FRONTEND_URL}/reset-password?token=…&email=…` — see Authentication & login. Whoever
  builds a client owns that page.
- **The deleted apps live only in git history.** Nothing was extracted to another repo.

**If a UI is ever wanted again, it does not belong in this repo.** The API is the product.

## Styling (Devilsberg brand, dark theme)

Hand-written CSS (no Tailwind), centrally located and **split by function** under
`public/css/`, mirroring the sibling-project convention (archivus, devilsberg-com). A single
entry `main.css` `@import`s, in cascade order: `tokens.css` → `base.css` → `layout.css` →
`components.css` → `utilities.css`. The landing page links `/css/main.css`; it is now the
only consumer. The stylesheet is kept whole rather than trimmed to what one page uses —
the app-shell rules cost nothing and document the house style.

- **Brand**: Devilsberg dark — Onyx (`#0a0a10`) canvas, Ghost White (`#f7f7ff`) text, Blue
  Slate borders/labels, Hot Fuchsia accents/errors, Sea Green for primary-button hover. All
  tokens (colours + `--font-title`/`--font-body`) live in `tokens.css`; no hardcoded hex
  elsewhere.
- **Type**: headings Lemon Milk (`@font-face`, falls back to `sans-serif` — the brand font
  file is not vendored, so a **text wordmark** stands in for the logo); body Open Sans (Bunny
  CDN `@import`).
- Components: `.btn`/`.btn--primary`/`.btn--ghost`/`.btn--sm`, `.form`/`.field`/`.error`,
  `.wordmark`, plus the app-shell patterns `.nav`, `.list`/`.list__row`, `.toolbar`,
  `.modal`, `.field__error`, `.app-main` (left over from the deleted frontend, unused
  today); visible focus affordance; single-column at `max-width: 768px`.

## Endpoints (so far)

- `GET /api/v1/ping` — public liveness check, returns `{ status: "ok", version: <from version.json via config('coevta.version')>, time: <ISO8601 UTC> }`.
- `POST /api/v1/login` — public; `{ email, password }` → `200 { token }`; bad creds `401` (generic message, no token); missing fields `422`. `throttle:6,1`.
- `POST /api/v1/forgot-password` — public; `{ email }` → `200` (same response for known/unknown emails, no enumeration). `throttle:6,1`. See Authentication & login.
- `POST /api/v1/reset-password` — public; `{ email, token, password, password_confirmation }` → `200`; invalid/expired token or `min:8`/`confirmed` failure → `422`. Revokes the user's existing tokens on success. `throttle:6,1`.
- `GET /api/v1/user` — returns the authenticated user (requires `auth:sanctum`).
- `POST /api/v1/logout` — `auth:sanctum`; revokes the current access token, returns `204`.

### Contacts (`auth:sanctum`)

Google People-compatible contact records. Full CRUD.

- `GET /api/v1/contacts` — full collection, unpaginated (no `meta`/`links`).
- `POST /api/v1/contacts` — create; `201` with the resource. `display_name` required.
- `GET /api/v1/contacts/{id}` — one contact; `404` if unknown.
- `PUT /api/v1/contacts/{id}` — full replacement; `404` if unknown.
- `PATCH /api/v1/contacts/{id}` — partial update; `404` if unknown. `display_name` still cannot be cleared (`null`/`""` → `422`), and an unreadable `birthday` → `422` with the stored date untouched.
- `DELETE /api/v1/contacts/{id}` — `204`; `404` if unknown.

**Model** (`App\Models\Contact` extends `BaseModel`; UUID v7 id; **no timestamps**):
`id`, `display_name` (required), `given_name`, `family_name`, `email`, `phone`, `organization`, `notes`, `address`, `birthday` (date-only, serialized `YYYY-MM-DD`). No `email` uniqueness. Only fillable fields persist; unknown body fields are ignored. Serialized via `App\Http\Resources\ContactResource`.

### Events (`auth:sanctum`)

Google Calendar-compatible events. Full CRUD. No recurrence, no `status`.

- `GET /api/v1/events` — **future events only**, unpaginated (no `meta`/`links`), ordered by `start_at` ascending. The cut-off is `end_at >= now()`, so an event that has started but not yet finished is still returned; anything already finished is omitted. Past events remain reachable via `GET /api/v1/events/{id}`.
- `POST /api/v1/events` — create; `201`.
- `GET /api/v1/events/{id}` — one event; `404` if unknown.
- `PUT /api/v1/events/{id}` — full replacement; `404` if unknown.
- `PATCH /api/v1/events/{id}` — partial update over the stored event, then re-normalized: a moved `start_at` drags `end_at`, `all_day` snaps the stored bounds. Unreadable `start_at`/`end_at` → `422`, event unmoved.
- `DELETE /api/v1/events/{id}` — `204`; `404` if unknown.

**Model** (`App\Models\Event` extends `BaseModel`; UUID v7 id; **no timestamps**):
`id`, `title`, `description`, `location`, `start_at`, `end_at`, `all_day`. Datetimes stored/returned as ISO 8601 UTC (`Z`). Serialized via `App\Http\Resources\EventResource`.

**Forgiving input** (the "minimize computer says no" principle — see CLAUDE.md). Normalization lives in `App\Http\Requests\Concerns\NormalizesEventInput::prepareForValidation()`, shared by store, update and patch (patch runs it over the merged record). Events are never rejected on these fields — except an unreadable date on a `PATCH`, see REST & API conventions:
- `title` → `"Untitled event"` when blank/missing.
- `start_at` → parsed (tz-less assumed UTC, offsets converted to UTC); falls back to now() if unparseable.
- `end_at` → `start_at + 1 hour` when missing or before `start_at`; kept when `== start_at`.
- `all_day` → coerced to boolean; when `true`, `start_at` is snapped to `00:00:00` and `end_at` to `23:59:59` of the end date (same day when `end_at` omitted).
- An empty `POST` body creates a valid event entirely from defaults.

### Tasks (`auth:sanctum`)

Google Tasks-compatible to-do items. Full CRUD. No `status` — completion is `completed_at` alone (`null` = open).

- `GET /api/v1/tasks` — full collection, unpaginated (no `meta`/`links`).
- `POST /api/v1/tasks` — create; `201`.
- `GET /api/v1/tasks/{id}` — one task; `404` if unknown.
- `PUT /api/v1/tasks/{id}` — full replacement; `404` if unknown. **Omitting `completed_at` reopens the task** — this is why `PATCH` exists.
- `PATCH /api/v1/tasks/{id}` — partial update; the safe way to edit a completed task. `completed_at: null` reopens, a value completes, absent leaves it alone. `duration: null` clears it, absent keeps the stored value. `due_has_time` is re-derived from the merged `due_at` and ignored if sent.
- `POST /api/v1/tasks/{id}/complete` — **no body**; stamps `completed_at = now()`, returns `200` + the task. Idempotent. Kept for clients that want server-stamped completion; a client that must work offline should send `completed_at` on an ordinary update instead.
- `DELETE /api/v1/tasks/{id}` — `204`; `404` if unknown.

**Model** (`App\Models\Task` extends `BaseModel`; UUID v7 id; **no timestamps**):
`id`, `title`, `notes`, `due_at`, `duration`, `completed_at`. Internal `due_has_time` column (not serialized) records whether `due_at` was given as a date or a datetime. Serialized via `App\Http\Resources\TaskResource`.

`duration` is an optional estimate in **whole minutes** (`null` = unknown), stored as a nullable `unsignedSmallInteger`. Google Tasks has no such field — this is a deliberate extension beyond the Google-compatible minimal set, added because clients otherwise invent their own storage for it. It maps onto an event's `start_at`/`end_at` span when a task is turned into a calendar block.

**Forgiving input** (`App\Http\Requests\Concerns\NormalizesTaskInput`):
- `title` → `"Untitled task"` when blank/missing.
- `due_at` → accepts **date-only OR datetime**; tz-less assumed UTC, offsets converted; unparseable → `null` (on `PATCH`: `422`, see REST & API conventions). Echoed back in the same granularity (date-only → `YYYY-MM-DD`, datetime → ISO 8601 UTC).
- `duration` → whole minutes. Numeric strings accepted, fractions rounded; `0`, negatives and anything unreadable (words, booleans, arrays) → `null`; values above **10080** (7 days) are clamped to that ceiling. Never a `422`.
- `completed_at` → datetime in UTC; unparseable → `null` (on `PATCH`: `422`).
- `PUT` is a full replacement: omitting `completed_at` reopens the task — and likewise omitting `duration` clears it. `PATCH` does neither.
- An empty `POST` body creates a valid open task.

