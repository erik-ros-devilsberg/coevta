---
story: Tasks REST API
created: 2026-06-23
---

## Description

Expose a minimalist **Tasks** resource over REST, with field shapes that map cleanly onto
the Google Tasks API task resource. Only the most important fields are carried.

Full CRUD: list, show, create, update, delete.

## Proposed fields (fine-tune before building)

| Field | Type | Required | Google Tasks mapping | Notes |
|-------|------|----------|----------------------|-------|
| `id` | uuid | auto | `id` | per foundation id strategy |
| `title` | string | yes | `title` | task title |
| `notes` | text | no | `notes` | free-text body |
| `due_at` | datetime | no | `due` | when the task is due (Google stores date-only RFC 3339) |
| `completed_at` | datetime | no | `completed` | set when status → `completed` |

### Open questions to fine-tune

- `due_at` as full datetime vs. date-only (Google treats `due` as date-only)? Default: datetime, nullable.
- Auto-manage `completed_at` when `status` flips to/from `completed`, or require the client to set it? Default: server-managed.
- Keep the `status` enum to exactly Google's two values, or add `cancelled`? Default: two values.

## Out of scope

- Subtasks / parent-child hierarchy (`parent`), manual ordering (`position`), task lists / multiple lists, links, deleted/hidden flags.

## Acceptance Criteria

- `GET /tasks` returns a paginated collection.
- `GET /tasks/{id}` returns a single task, `404` when missing.
- `POST /tasks` creates a task; `title` required, `status` defaults to `needsAction`.
- `PUT/PATCH /tasks/{id}` updates a task; setting `status` to `completed` sets `completed_at` (per the open question default).
- `DELETE /tasks/{id}` removes a task.
- `status` accepts only the allowed enum values.
- Datetimes accepted and returned as ISO 8601 UTC; `due_at` and `completed_at` nullable.
- Feature tests cover each endpoint (happy path + validation + not-found + completion behaviour); PHPStan and PHP-CS-Fixer pass.
