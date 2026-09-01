---
story: Task Duration
created: 2026-09-01
---

## Description

Tasks need an optional `duration` field — an estimate, in whole minutes, of how long
the task takes. It lets a client budget a day's workload or block time on a calendar
without inventing its own storage.

`duration` is optional and defaults to `null` (unknown). Google Tasks has no duration
field, so this is a deliberate extension beyond the Google-compatible minimal set; it
maps naturally onto an event's `start_at`/`end_at` span when a client turns a task into
a calendar entry.

Per the "minimize computer says no" principle the field is normalized in the task
FormRequest concern (`NormalizesTaskInput`) rather than rejected, so store, update and
patch behave identically.

## Acceptance Criteria

- `tasks` table gains a nullable unsigned integer `duration` column; existing rows keep `null`.
- `POST /tasks` and `PUT /tasks/{id}` accept an optional `duration` in minutes; omitting it stores `null`.
- `PATCH /tasks/{id}` can set `duration` and can clear it by sending `null`, leaving other fields untouched.
- `TaskResource` exposes `duration` as an integer or `null`.
- Normalization (never a `422`):
  - numeric strings (`"45"`) are accepted as integers
  - fractional values are rounded to the nearest whole minute
  - zero and negative values become `null`
  - non-numeric or unparseable values become `null`
  - values above a documented ceiling (10080 minutes = 7 days) are clamped to that ceiling
- The task factory can generate a duration, and existing task tests still pass unchanged.
- `docs/system.md` documents the `duration` defaults alongside the other task defaults.
