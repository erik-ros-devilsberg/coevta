---
sprint: SPA To-Do Module
stories:
  - 14-spa-todo-module
status: planned
created: 2026-06-24
---

## Goal

Add a minimalist to-do module to the SPA: manage tasks against the existing Tasks API,
including quick-add, the no-body complete action, and full-replacement edits. Reuses the
app shell from the Contacts sprint and introduces the shared **local-timezone datetime
util** that the Calendar module will also use. Sleek, on the Devilsberg dark brand.

## Decisions (from shaping)

- **Depends on the Contacts sprint** (app shell / nav / confirm-delete / list patterns).
- **Introduces `lib/datetime.js`** — the shared util for displaying datetimes in the user's
  local timezone while sending/receiving ISO 8601 UTC, plus date-only handling. Calendar
  reuses it.
- **No backend changes** beyond serving the SPA shell at `/tasks`.
- Styling stays central (Devilsberg tokens, BEM); JS logic tested with `node --test`.

## Design direction (Devilsberg, minimalist)

- Two clean sections: **Open** and **Completed**; completed items dimmed (Gray Mid,
  strikethrough optional) and de-emphasised below the open list.
- A single sleek quick-add input at the top (Open Sans, Blue Slate border, focus ring);
  Enter creates. Each row: a checkbox/toggle, title, and a muted `due_at`.
- Primary actions use `.btn--primary` (Sea Green hover); destructive delete behind the
  shared confirm modal. No priorities, colours or drag handles.

## Acceptance Criteria

### To-Do module (maps to story 14)

- [ ] A list view loads tasks from `GET /api/v1/tasks` (paginated, 25/page) and separates
      open tasks (`completed_at = null`) from completed ones.
- [ ] `due_at` displays in the granularity the API returns: date-only as `YYYY-MM-DD`,
      datetime in the user's local timezone (sent/stored as ISO 8601 UTC).
- [ ] A quick-add input creates a task with just a title via `POST /api/v1/tasks`; it appears
      in the open list without a full reload.
- [ ] A checkbox/toggle completes a task via `POST /api/v1/tasks/{id}/complete` (no body,
      idempotent); it moves to the completed group.
- [ ] Editing (title, notes, due date) issues `PUT /api/v1/tasks/{id}`; because PUT is a full
      replacement the form **resends `completed_at`** to keep a completed task completed, and
      omitting it reopens the task.
- [ ] Delete via `DELETE /api/v1/tasks/{id}` behind a confirm step.
- [ ] API errors surface a non-blocking message; a `401` redirects to `/login`.
- [ ] Loading and empty states are shown ("Nothing to do").
- [ ] Minimalist: no subtasks, lists, priorities or recurrence.

### Shared datetime util

- [ ] `lib/datetime.js` converts API values for display in local time and back to ISO 8601
      UTC for sending, and preserves date-only vs datetime granularity.

### Quality

- [ ] `lib/tasks.js` and `lib/datetime.js` have Node tests (CRUD calls incl. the complete
      action and the PUT-resends-`completed_at` behaviour; datetime round-trips/granularity).
- [ ] `routes/web.php` serves the SPA shell at `/tasks` (with a `SpaServingTest` case); the
      router has a `requiresAuth` `/tasks` route; deep-linking resolves.
- [ ] `npm run build` succeeds; `npm test` passes; `composer gates` passes.

## Tasks

- [ ] Add `lib/datetime.js` (local-tz display, ISO-UTC send, date-only granularity) + Node
      tests first, then implement.
- [ ] Add `lib/tasks.js` (list/create/update/remove/complete over `apiFetch`) + Node tests
      first, then implement.
- [ ] Add `TasksView.vue` with the open/completed split, quick-add, completion toggle, and an
      edit form (resending `completed_at`); reuse the shell nav + confirm modal.
- [ ] Register the `/tasks` route (`requiresAuth`); serve the shell at `/tasks` in
      `routes/web.php`; add a `SpaServingTest` case.
- [ ] Extend `public/css/` minimally for the open/completed list + quick-add (Devilsberg
      tokens, AA, 768px responsive).
- [ ] Run `npm test`, `npm run build`, `composer gates`; fix any failures.

## Risks and Open Questions

- **PUT full-replacement footgun**: the edit form must resend `completed_at` or it silently
  reopens the task — cover this explicitly in the `lib/tasks.js` test and the UI.
- **Local timezone correctness**: keep all storage/transport in UTC; only format for display.
  The datetime util is the single place this logic lives — test round-trips.
- **Depends on the Contacts sprint** shell being in place.
