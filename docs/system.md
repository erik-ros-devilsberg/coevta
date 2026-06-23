
# System Documentation

This file is maintained by `/agile:wrap-sprint`. Read this to understand the system without reading all the code.

## Foundation decisions (locked)

These were decided in the Project Foundation sprint and apply to every later feature:

- **Framework**: Laravel 13 (PHP 8.4), minimalist skeleton structure (no HTTP Kernel; `bootstrap/app.php` configures routing/middleware/exceptions).
- **IDs**: domain entities use **UUID v7** string primary keys via `App\Models\BaseModel` (which uses `App\Models\Concerns\HasUuidV7`, a thin wrapper over Laravel's `HasUuids` → `Str::uuid7()`). Entity models extend `BaseModel`. The `users` table keeps Laravel's default auto-increment id (it is infrastructure, not a domain entity).
- **API prefix / versioning**: all routes under `/api/v1` (the `/api` prefix comes from `bootstrap/app.php`; the `v1` segment from a route group in `routes/api.php`).
- **Auth**: Laravel **Sanctum** token auth. Protected routes use the `auth:sanctum` middleware. Tokens are minted via the `coevta:create-token {email}` artisan command (creates the user if absent) — the minimal "standard user" path until a full user-management story exists.
- **Soft deletes**: off. `DELETE` removes rows permanently.
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
- **Coverage** — `composer coverage` runs PHPUnit with clover output and `bin/coverage-check.php` enforces a **90%** line-coverage minimum. **Requires a coverage driver (pcov or xdebug)**, which is not installed in the current environment — the gate is configured but cannot execute here until a driver is added.

## Endpoints (so far)

- `GET /api/v1/ping` — public liveness check, returns `{ status: "ok", version: <from version.json via config('coevta.version')>, time: <ISO8601 UTC> }`.
- `GET /api/v1/user` — returns the authenticated user (requires `auth:sanctum`).

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

