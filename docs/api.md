# coevta REST API

REST/JSON backend for **CO**ntacts, **EV**ents and **TA**sks. Field names and shapes
mirror the Google People / Calendar / Tasks APIs (minimal subset).

> ⚠️ **Auth section is under active development** — the authentication endpoints
> (`/login`, `/logout`, `/forgot-password`, `/reset-password`) are owned by another
> agent and may change. The CRUD resources below are stable.

## Conventions

- **Base URL**: all routes are under `/api/v1`.
- **Content type**: JSON in, JSON out (`Content-Type: application/json`, `Accept: application/json`).
- **IDs**: domain entities use **UUID v7** string ids. `user_id` is never accepted from the
  body nor serialized in responses.
- **Timestamps**: serialized as RFC 3339 / ISO 8601 UTC with a trailing `Z`
  (e.g. `2026-06-24T12:00:00.000000Z`). Date-only fields use `YYYY-MM-DD`.
- **Update semantics**: `PUT` is a **full replacement** — every field you leave out is reset
  to its default (see each resource for what that means). `PATCH` is a **partial update** —
  only the fields present in the body change. See "Partial updates (PATCH)" below.
- **Pagination**: collections are paginated, **25 per page** (Laravel paginator envelope:
  `data`, `links`, `meta`).
- **Ownership**: every record belongs to the authenticated user. Another user's id is
  reported as `404` (never `403`) — existence is not disclosed.

### Authentication

Protected routes require a **Sanctum bearer token**:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/v1/login`, or mint one out-of-band with the
`php artisan coevta:create-token {email}` command.

### Error envelope

Gated to `api/*` paths; always JSON:

| Status | Shape |
| ------ | ----- |
| `422` validation | `{ "message": ..., "errors": { "field": ["..."] } }` |
| `404` not found | `{ "message": ... }` |
| `400` bad request | `{ "message": ... }` |
| `401` unauthenticated / bad credentials | `{ "message": ... }` |
| `405` method not allowed | `{ "message": ... }` |

### Forgiving input ("minimize computer says no")

Events and tasks **normalize and coerce** input in `prepareForValidation()` rather than
reject it. Sensible defaults are applied for missing/contradictory values, so these
resources effectively never `422` on their own fields. Contacts validate strictly except
that only `display_name` is required. Details under each resource.

### Partial updates (PATCH)

`PATCH /api/v1/{contacts,events,tasks}/{id}` changes **only the fields the body carries**.
Everything else keeps its stored value. Same response shape and status codes as `PUT`.

- **Absent key** → field unchanged. `PATCH {"title": "New"}` on a task touches nothing else —
  in particular it does **not** reopen a completed task, which the equivalent `PUT` does.
- **Explicit `null`** → field cleared: `{"email": null}` clears the email; omitting `email`
  keeps it. `""` clears a date field too.
- **`PATCH {}`** is a no-op: `200` with the record unchanged.
- **Unknown fields** are ignored, not rejected.

The patch is merged onto the stored record and the **whole merged record is then
normalized**, so the cross-field rules still apply:

```http
PATCH /api/v1/events/{id}
{ "start_at": "2026-07-01T14:00:00Z" }        → end_at moves to 15:00 if it was before the new start

PATCH /api/v1/events/{id}
{ "all_day": true }                            → the stored start/end snap to whole-day bounds

PATCH /api/v1/tasks/{id}
{ "due_at": "2026-07-12" }                     → due_at loses its time (date-only granularity)
```

**One deliberate difference from `PUT`: a date PATCH cannot read is a `422`.**

```http
PUT   /api/v1/tasks/{id}  { …, "due_at": "banana" }   → 200, due_at cleared to null
PATCH /api/v1/tasks/{id}  { "due_at": "banana" }      → 422 { errors: { due_at: [...] } }, stored value untouched
```

On a full replacement the client is sending the whole record and coercion is safe. On a
partial update, silently wiping or moving a stored date because of a typo is worse than
saying no. Applies to `birthday`, `start_at`, `end_at`, `due_at` and `completed_at`. This is
the one place the API deliberately steps outside "minimize computer says no".

Contacts keep their one hard rule under PATCH: `display_name` cannot be set to `null` or
`""` (`422`). No other field can fail validation on any resource.

---

## Health

### `GET /api/v1/ping`
Public liveness check. No auth.

**200**
```json
{
  "status": "ok",
  "version": "0.0.0",
  "time": "2026-06-24T12:00:00.000000Z"
}
```
`version` comes from `version.json` via `config('coevta.version')`.

---

## Auth (under active development)

> Owned by another agent — current behaviour documented for reference; subject to change.

### `POST /api/v1/login`
Public. Exchanges credentials for a Sanctum token. Rate-limited `throttle:6,1` (6/min).

**Request**
```json
{ "email": "user@example.com", "password": "secret" }
```

**200** → `{ "token": "<plain-text-token>" }`
**401** → `{ "message": "These credentials do not match our records." }` (generic — no
account enumeration; response time is equalized against unknown emails)
**422** → missing fields.

### `POST /api/v1/logout`
Requires bearer token. Revokes **only** the token used for the request. **204** no content.

### `POST /api/v1/forgot-password`
Public. `throttle:6,1`. Body `{ "email": "..." }`. Always responds the same way whether
or not the address exists (no enumeration).

**The reset page is yours to build.** The emailed link points at
`{FRONTEND_URL}/reset-password?token=…&email=…` — this backend serves no such page (it
ships no frontend at all). Point `FRONTEND_URL` at your client, read `token` and `email`
from the query string, and post them to `reset-password` below.

### `POST /api/v1/reset-password`
Public. `throttle:6,1`. Applies a new password for a valid token and revokes existing
tokens.

**Request**
```json
{ "token": "...", "email": "user@example.com", "password": "newsecret", "password_confirmation": "newsecret" }
```
Password policy: `min:8`, `confirmed`.

### `GET /api/v1/user`
Requires bearer token. Returns the authenticated user.

---

## Contacts

Google People-compatible records. Full CRUD.

| Verb | Path | Result |
| ---- | ---- | ------ |
| GET | `/api/v1/contacts` | `200` paginated collection (25/page) |
| POST | `/api/v1/contacts` | `201` the created contact |
| GET | `/api/v1/contacts/{id}` | `200` one contact; `404` if unknown |
| PUT | `/api/v1/contacts/{id}` | `200` full replacement; `404` if unknown |
| PATCH | `/api/v1/contacts/{id}` | `200` partial update; `404` if unknown |
| DELETE | `/api/v1/contacts/{id}` | `204`; `404` if unknown |

**Fields**

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | string (UUID v7) | response only |
| `display_name` | string | **required**, max 255 |
| `given_name` | string\|null | max 255 |
| `family_name` | string\|null | max 255 |
| `email` | string\|null | valid email, max 255, **not unique** |
| `phone` | string\|null | max 255 |
| `organization` | string\|null | max 255 |
| `notes` | string\|null | |
| `address` | string\|null | max 255 |
| `birthday` | date\|null | serialized `YYYY-MM-DD` |

Unknown body fields are ignored. Only `display_name` is required; everything else optional.

**Example — create**
```http
POST /api/v1/contacts
Authorization: Bearer <token>

{ "display_name": "Ada Lovelace", "email": "ada@example.com", "birthday": "1815-12-10" }
```
**201**
```json
{
  "data": {
    "id": "0190d...",
    "display_name": "Ada Lovelace",
    "given_name": null,
    "family_name": null,
    "email": "ada@example.com",
    "phone": null,
    "organization": null,
    "notes": null,
    "address": null,
    "birthday": "1815-12-10"
  }
}
```

---

## Events

Google Calendar-compatible events. Full CRUD. No recurrence, no `status`.

| Verb | Path | Result |
| ---- | ---- | ------ |
| GET | `/api/v1/events` | `200` paginated collection (25/page) |
| POST | `/api/v1/events` | `201` the created event |
| GET | `/api/v1/events/{id}` | `200` one event; `404` if unknown |
| PUT | `/api/v1/events/{id}` | `200` full replacement; `404` if unknown |
| PATCH | `/api/v1/events/{id}` | `200` partial update, re-normalized; `404` if unknown |
| DELETE | `/api/v1/events/{id}` | `204`; `404` if unknown |

**Fields**

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | string (UUID v7) | response only |
| `title` | string | max 255 |
| `description` | string\|null | |
| `location` | string\|null | max 255 |
| `start_at` | datetime | ISO 8601 UTC |
| `end_at` | datetime | ISO 8601 UTC |
| `all_day` | boolean | |

**Forgiving input** — events are never rejected on these fields:
- `title` → `"Untitled event"` when blank/missing.
- `start_at` → parsed (tz-less assumed UTC, offsets converted to UTC); falls back to
  `now()` if unparseable.
- `end_at` → `start_at + 1 hour` when missing or before `start_at`; kept when `== start_at`.
- `all_day` → coerced to boolean. When `true`, `start_at` snaps to `00:00:00` and `end_at`
  to `23:59:59` of the end date (same day when `end_at` omitted).
- An **empty POST body** creates a valid event entirely from defaults.

**Example — create**
```http
POST /api/v1/events
Authorization: Bearer <token>

{ "title": "Standup", "start_at": "2026-06-25T09:00:00Z" }
```
**201**
```json
{
  "data": {
    "id": "0190d...",
    "title": "Standup",
    "description": null,
    "location": null,
    "start_at": "2026-06-25T09:00:00.000000Z",
    "end_at": "2026-06-25T10:00:00.000000Z",
    "all_day": false
  }
}
```

---

## Tasks

Google Tasks-compatible to-do items. Full CRUD. No `status` — completion is `completed_at`
alone (`null` = open).

| Verb | Path | Result |
| ---- | ---- | ------ |
| GET | `/api/v1/tasks` | `200` paginated collection (25/page) |
| POST | `/api/v1/tasks` | `201` the created task |
| GET | `/api/v1/tasks/{id}` | `200` one task; `404` if unknown |
| PUT | `/api/v1/tasks/{id}` | `200` full replacement — **omitting `completed_at` reopens the task**; `404` if unknown |
| PATCH | `/api/v1/tasks/{id}` | `200` partial update — safe to edit a completed task; `404` if unknown |
| POST | `/api/v1/tasks/{id}/complete` | `200` the task — **no body**; stamps `completed_at = now()`. Idempotent |
| DELETE | `/api/v1/tasks/{id}` | `204`; `404` if unknown |

**Fields**

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | string (UUID v7) | response only |
| `title` | string | max 255 |
| `notes` | string\|null | |
| `due_at` | date or datetime \| null | echoed in the granularity given (date-only → `YYYY-MM-DD`, datetime → ISO 8601 UTC) |
| `completed_at` | datetime\|null | ISO 8601 UTC; `null` = open |

> Internal `due_has_time` column tracks whether `due_at` was a date or a datetime — it is
> not serialized.

**Forgiving input**:
- `title` → `"Untitled task"` when blank/missing.
- `due_at` → accepts **date-only OR datetime**; tz-less assumed UTC, offsets converted;
  unparseable → `null`.
- `completed_at` → datetime in UTC; unparseable → `null`.
- **PUT is a full replacement**: omitting `completed_at` reopens the task.
- An **empty POST body** creates a valid open task.

**Example — complete**
```http
POST /api/v1/tasks/0190d.../complete
Authorization: Bearer <token>
```
**200**
```json
{
  "data": {
    "id": "0190d...",
    "title": "Write docs",
    "notes": null,
    "due_at": "2026-06-25",
    "completed_at": "2026-06-24T12:00:00.000000Z"
  }
}
```
