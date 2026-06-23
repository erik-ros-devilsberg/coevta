---
story: Per-user entity ownership
created: 2026-06-24
---

## Description

Today the contacts, events and tasks resources are **not bound to a user**. Any valid
Sanctum token can read and modify *every* record in the system — there is one shared
dataset. Each user must instead own a private set of contacts, events and tasks: a user
can only list, show, update, complete or delete records they created.

This is a foundational change that retrofits all three already-built entities. It adds a
`user_id` owner to each entity, sets it automatically from the authenticated user on
create, and **scopes every query to the authenticated user** so cross-user access is
impossible.

## Approach (to confirm at shape time)

- **Ownership column**: add a non-nullable `user_id` foreign key to `contacts`, `events`
  and `tasks`, referencing `users.id` (Laravel's auto-increment bigint per the foundation
  decision — so `foreignId('user_id')->constrained()->cascadeOnDelete()`).
- **Set on create**: `user_id` is taken from the authenticated user (`$request->user()`),
  never from the request body. A `user_id` sent in the body is ignored.
- **Enforcement = explicit scoping in controllers** (chosen over a global scope): every
  controller method queries through the authenticated user's relation rather than the bare
  model, e.g. `$request->user()->contacts()->paginate()` and
  `$request->user()->contacts()->findOrFail($id)`. A record owned by another user is
  therefore **not found** (`404`), not forbidden (`403`) — we do not reveal its existence.
- **Models**: each entity gets a `belongsTo(User::class)` relation; `User` gets
  `hasMany` relations (`contacts()`, `events()`, `tasks()`).
- **`user_id` is never serialized** in the API resources (it is implicit from the token).

## Out of scope

- Sharing / collaboration (multiple owners, shared calendars, ACLs).
- Roles / admin override (an admin seeing all users' data) — belongs with user management.
- Teams / organizations as an ownership boundary.
- Backfilling/migrating existing rows to an owner (dev data; the migration may assume an
  empty table or assign to a seeded user — decide at shape time).

## Acceptance Criteria

- Each of `contacts`, `events`, `tasks` has a non-nullable `user_id` FK to `users`,
  cascading on user delete.
- `POST` to any of the three sets `user_id` to the authenticated user; a `user_id` in the
  request body is ignored.
- `GET /api/v1/{contacts,events,tasks}` returns only the authenticated user's records
  (another user's records never appear, and pagination counts reflect only owned rows).
- `GET/PUT/DELETE /api/v1/{resource}/{id}` for a record owned by a **different** user
  returns `404` (not `403`), as if it does not exist.
- `POST /api/v1/tasks/{id}/complete` on another user's task returns `404`.
- Two users with separate tokens have fully isolated datasets (a feature test creates
  records as user A and asserts user B sees none of them across index/show/update/delete).
- `user_id` does not appear in any API response body.
- Models expose `belongsTo`/`hasMany` relations; existing entity behaviour (defaults,
  forgiving input, PUT-only updates) is unchanged.
- Factories set/allow a `user_id` so existing feature tests still pass.
- `docs/system.md` documents the ownership model as a locked foundation decision.
- `composer gates` passes (style, PHPStan max, PHPUnit, coverage ≥90%, audit).
