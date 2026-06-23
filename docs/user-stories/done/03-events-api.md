---
story: Events REST API
created: 2026-06-23
---

## Description

Expose a minimalist **Events** resource over REST, with field shapes that map cleanly onto
the Google Calendar API event resource. Every event has a start date-time and an end
date-time. **Repetition/recurrence is out of scope.**

Full CRUD: list, show, create, update, delete.

## Proposed fields (fine-tune before building)

| Field | Type | Required | Google Calendar mapping | Notes |
|-------|------|----------|-------------------------|-------|
| `id` | uuid | auto | `id` | per foundation id strategy |
| `title` | string | yes | `summary` | event title |
| `description` | text | no | `description` | |
| `location` | string | no | `location` | free-text location |
| `start_at` | datetime | yes | `start.dateTime` | ISO 8601 UTC |
| `end_at` | datetime | yes | `end.dateTime` | ISO 8601 UTC; must be ≥ `start_at` |
| `status` | enum | no | `status` | `confirmed` \| `tentative` \| `cancelled`; default `confirmed` |

### Open questions to fine-tune

- Support an `all_day` boolean (Google uses `start.date`/`end.date` for all-day)? Default: **no** for v1, datetime only.
- Store/return a timezone per event (`start.timeZone`), or assume UTC everywhere? Default: UTC.
- Keep `status` in v1, or defer? Default: keep, simple enum.
- Validation: reject `end_at < start_at`? Default: yes.

## Out of scope

- Recurrence / repetition (`recurrence`, `recurringEventId`), attendees, reminders, conferencing, attachments, visibility, colors, organizer/creator.

## Acceptance Criteria

- `GET /events` returns a paginated collection.
- `GET /events/{id}` returns a single event, `404` when missing.
- `POST /events` creates an event; `title`, `start_at`, `end_at` required.
- `end_at` must be greater than or equal to `start_at`, else `422`.
- `PUT/PATCH /events/{id}` updates an existing event.
- `DELETE /events/{id}` removes an event.
- `status` accepts only the allowed enum values; defaults to `confirmed`.
- Datetimes accepted and returned as ISO 8601 UTC.
- Feature tests cover each endpoint (happy path + validation + not-found + start/end rule); PHPStan and PHP-CS-Fixer pass.
