---
story: SPA To-Do Module
created: 2026-06-24
---

## Description

A minimalist to-do module for the SPA dashboard that lets an authenticated user manage
tasks through the existing Tasks API (`/api/v1/tasks`). Scope is the minimal Google
Tasks-compatible set: `title`, `notes`, an optional `due_at` (date or datetime) and
completion via `completed_at` (`null` = open). No subtasks, lists/projects, priorities or
recurrence.

The module consumes the stable Tasks endpoints documented in `docs/api.md`, including the
no-body complete convenience action, and authenticates with the SPA's Sanctum bearer
token.

## Acceptance Criteria

- A list view loads tasks from `GET /api/v1/tasks` (paginated, 25/page) and separates
  open tasks (`completed_at = null`) from completed ones.
- `due_at` is displayed in the granularity returned by the API: date-only as `YYYY-MM-DD`,
  datetime in the user's local timezone (sent/stored as ISO 8601 UTC).
- A quick-add input creates a task with just a title via `POST /api/v1/tasks`; the task
  appears in the open list without a full reload.
- A checkbox/toggle marks a task complete via `POST /api/v1/tasks/{id}/complete`
  (no body, idempotent); the task moves to the completed group.
- Editing a task (title, notes, due date) issues `PUT /api/v1/tasks/{id}`; note that PUT
  is a full replacement, so the form must resend `completed_at` to keep a task complete,
  and omitting it reopens the task.
- A task can be deleted via `DELETE /api/v1/tasks/{id}` with a confirmation step.
- API errors surface a non-blocking message; a `401` redirects to login.
- Loading and empty states are shown (e.g. "Nothing to do").
- The module is minimalist: no subtasks, lists, priorities or recurrence.
