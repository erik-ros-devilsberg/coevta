---
sprint: Tasks REST API
stories:
  - 04-tasks-api
status: done
created: 2026-06-23
---

## Goal

Add the third and final v1 domain entity: a minimalist, Google Tasks-compatible **Tasks**
resource with full REST CRUD under `/api/v1/tasks`. Completes the contacts/events/tasks
triad on the established patterns (BaseModel/UUID v7, Sanctum, FormRequest normalization,
API Resource, pagination) and the "minimize computer says no" philosophy.

## Locked decisions

- **Auth**: all tasks routes require `auth:sanctum`.
- **Updates**: `PUT` only (full replacement) — no `PATCH` (`405`).
- **No timestamps**: tasks carry no `created_at`/`updated_at` (`$timestamps = false`).
- **No `status`**: dropped. Completion is represented solely by **`completed_at`**: `null` = open, a timestamp = done. The client sets it to complete a task and omits/nulls it to reopen.
- **Convenience completion endpoint**: `POST /api/v1/tasks/{id}/complete` (no body/parameters) stamps `completed_at = now()` (UTC) and returns the updated task. Idempotent — completing an already-complete task just re-stamps `now()`. Saves clients from constructing a full `PUT` body just to tick a task off.
- **`due_at` is flexible** — it accepts **either** a date-only value (`2026-07-01`) **or** a full datetime (`2026-07-01T14:00:00Z`). The API echoes back the same granularity it was given (date-only in → `YYYY-MM-DD` out; datetime in → ISO 8601 UTC out). This is tracked by an internal `due_has_time` boolean column (not exposed in the API).
- **Minimize "computer says no"** (project principle, see CLAUDE.md):
  - `title` → `"Untitled task"` when blank/missing.
  - `due_at` / `completed_at` → nullable; tz-less values assumed UTC, offsets converted to UTC; **unparseable values become `null`** rather than a `422`.
  - An empty `POST` body creates a valid open task.
- **IDs**: UUID v7 via `App\Models\BaseModel`. **Pagination**: 25/page. **Soft deletes**: off.

## Fields (final v1 set)

| Field | Type | Required | Google Tasks mapping |
|-------|------|----------|----------------------|
| `id` | uuid (v7) | auto | `id` |
| `title` | string | no (default `"Untitled task"`) | `title` |
| `notes` | text | no | `notes` |
| `due_at` | date **or** datetime (flexible) | no | `due` |
| `completed_at` | datetime (UTC) | no | `completed` |

No `status`, no `created_at`/`updated_at`. Internal-only: `due_has_time` (boolean, not serialized).

## Out of scope

Subtasks / parent-child (`parent`), manual ordering (`position`), task lists / multiple lists, links, deleted/hidden flags, a `status` enum.

## Acceptance Criteria

- [ ] `GET /api/v1/tasks` returns a paginated collection (25/page) for an authenticated request.
- [ ] `GET /api/v1/tasks/{id}` returns one task; `404` JSON envelope when unknown.
- [ ] `POST /api/v1/tasks` with a valid body creates a task, returns `201` with a UUID v7 `id`.
- [ ] `POST` with an empty body succeeds (`201`): `title` = "Untitled task", `due_at` = null, `completed_at` = null.
- [ ] `POST` with `due_at` = `"2026-07-01"` returns `due_at` = `"2026-07-01"` (date-only round-trip).
- [ ] `POST` with `due_at` = `"2026-07-01T14:00:00Z"` returns `due_at` as ISO 8601 UTC (`...Z`).
- [ ] `POST` with a tz-less or offset `due_at`/`completed_at` is stored/returned in UTC.
- [ ] `POST` with an unparseable `due_at`/`completed_at` → that field is `null` (no `422`).
- [ ] Setting `completed_at` marks the task done; a task with `completed_at` = null is open.
- [ ] `POST /api/v1/tasks/{id}/complete` with no body returns `200` and the task with `completed_at` set to ~now (UTC); `404` when unknown; requires auth (`401` without token).
- [ ] `PUT /api/v1/tasks/{id}` replaces the task; omitting `completed_at` reopens it (full-replacement semantics). `404` when unknown. `PATCH` → `405`.
- [ ] `DELETE /api/v1/tasks/{id}` removes the task, returns `204`; `404` when unknown.
- [ ] Every tasks endpoint returns `401` without a valid Sanctum token.
- [ ] `TaskResource` exposes exactly: `id`, `title`, `notes`, `due_at`, `completed_at` (no `status`, no `due_has_time`, no timestamps).
- [ ] Unknown/extra fields in the request body are ignored.
- [ ] `composer gates` passes (style, PHPStan max, PHPUnit, coverage ≥90%, audit).

## Tasks

- [ ] Migration `create_tasks_table`: UUID PK, `title`, nullable `notes`, nullable `due_at` datetime, `due_has_time` boolean default false, nullable `completed_at` datetime; **no `timestamps()`**.
- [ ] `App\Models\Task` extending `BaseModel`: `$fillable` (incl. `due_has_time`), `public $timestamps = false;`, casts (`due_at`/`completed_at` => `datetime`, `due_has_time` => `boolean`), `@property` annotations.
- [ ] `TaskFactory`.
- [ ] `NormalizesTaskInput` trait (`prepareForValidation()`, shared by store + update): default `title`; parse `due_at` accepting date-only or datetime (set `due_has_time` accordingly; tz-less → UTC; unparseable → null); parse `completed_at` (UTC; unparseable → null).
- [ ] `StoreTaskRequest` / `UpdateTaskRequest`: nullable rules; validation runs against normalized values so it effectively never fails.
- [ ] `TaskResource`: `due_at` rendered date-only (`Y-m-d`) when `due_has_time` is false, else ISO 8601 UTC; `completed_at` ISO 8601 UTC or null.
- [ ] Thin `TaskController` (index/show/store/update/destroy + `complete`).
- [ ] Routes under `auth:sanctum` `/api/v1`: `apiResource('tasks')->except('update')` + explicit `Route::put('tasks/{task}', ...)` + `Route::post('tasks/{task}/complete', ...)`.
- [ ] Feature tests: index (paginated, auth), show (200 + 404), store (201 valid + empty-body defaults), due_at date-only round-trip, due_at datetime round-trip, tz handling, unparseable → null, completed_at set/clear, complete endpoint (200 sets completed_at + 404 + 401), PUT replace (200 + 404), PATCH 405, destroy (204 + 404), 401-without-token per verb, exact resource fields.
- [ ] Update `docs/system.md` with the tasks endpoints and field set.

## Risks and Open Questions

- **`due_at` round-trip via `due_has_time`** (the notable design choice): we store a datetime plus a hidden boolean so date-only and datetime inputs both echo back faithfully. Alternative would be to always return datetime (simpler, but loses the "due Tuesday, no time" intent). Going with the flexible round-trip per "be flexy".
- **PUT reopens completed tasks**: because `PUT` is a full replacement, a client that omits `completed_at` will null it (reopen). This is consistent with PUT semantics across the API; clients must send the full representation. Note it in docs.
- **Forgiveness hides mistakes** (accepted trade-off): an unparseable `due_at` silently becomes `null` rather than erroring — intended behaviour.
- **Coverage** gate runs (pcov installed); keep ≥90%.
