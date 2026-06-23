---
story: User management endpoint
created: 2026-06-24
---

## Description

Provide a REST surface for managing users. Today users only exist via the
`coevta:create-token` artisan command and the read-only `GET /api/v1/user` (the
authenticated user). This story adds a proper way to create, view, update and delete
users, plus self-service account actions, over the API.

Builds on [05-entity-ownership]: once entities are owned by users, we need a real way to
provision and manage those users.

## Proposed surface (fine-tune at shape time)

### Self-service (any authenticated user, acts on themselves)

- `GET /api/v1/user` — current user (already exists).
- `PUT /api/v1/user` — update own `name` / `email`.
- `POST /api/v1/user/password` — change own password (requires current password).

### Admin (guarded — see open questions)

- `GET /api/v1/users` — paginated list of users.
- `POST /api/v1/users` — create a user (`name`, `email`, `password`).
- `GET /api/v1/users/{id}` — show a user.
- `PUT /api/v1/users/{id}` — update a user.
- `DELETE /api/v1/users/{id}` — delete a user (cascades to their contacts/events/tasks
  per the ownership FK).

### Token management (optional, fine-tune)

- `POST /api/v1/users/{id}/tokens` — mint a Sanctum token for a user (returns plaintext
  once). Replaces the artisan-only path for API-driven provisioning.

## Open questions to fine-tune

- **Authorization model**: admin endpoints need an admin/regular distinction. Add a
  minimal `is_admin` boolean to `users`? Default: yes, minimal flag (no full RBAC).
- **Password rules**: how forgiving? Per the project principle, prefer sensible minimums
  over strict rejection — but passwords are security-sensitive, so a real minimum length
  is warranted. Default: min 8 chars, hashed via Laravel `Hash`.
- **Email uniqueness**: enforce unique `email` (unlike contacts, which allow dupes).
  Default: unique, `422` on collision (a genuine "cannot interpret" case).
- **`coevta:create-token`**: keep as-is for bootstrapping the first admin, or deprecate
  once `POST /users/{id}/tokens` exists? Default: keep (bootstrap path).

## Out of scope

- Roles/permissions beyond a single `is_admin` flag, email verification, password-reset
  email flows, OAuth / social login, MFA, soft-deleting users.

## Acceptance Criteria

- `PUT /api/v1/user` updates the authenticated user's `name`/`email`; `email` stays unique.
- `POST /api/v1/user/password` changes the password only when the current password is
  correct; wrong current password → `422`/`403`.
- Admin-guarded endpoints return `403` for a non-admin token and work for an admin token.
- `POST /api/v1/users` creates a user with a hashed password; duplicate email → `422`.
- `DELETE /api/v1/users/{id}` removes the user and cascades to their owned entities.
- Passwords are never returned in any response; `password` is hidden on the model.
- Feature tests cover self-service, admin CRUD, the authorization boundary
  (non-admin `403`), email uniqueness, and password change.
- `composer gates` passes (style, PHPStan max, PHPUnit, coverage ≥90%, audit).
