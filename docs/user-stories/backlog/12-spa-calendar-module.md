---
story: SPA Calendar Module
created: 2026-06-24
---

## Description

A minimalist calendar module for the SPA dashboard that lets an authenticated user
view, create, edit and delete events through the existing Events API
(`/api/v1/events`). Scope is deliberately small: a single month view plus a simple
create/edit form. No recurrence, attendees, reminders or multiple calendars — those map
to fields the API does not carry yet.

The module consumes the stable Events endpoints documented in `docs/api.md` and respects
their forgiving-input behaviour (sensible defaults, ISO 8601 UTC timestamps, `all_day`
handling). It authenticates with the Sanctum bearer token already held by the SPA.

## Acceptance Criteria

- A month grid view renders the current month and highlights today; users can page to the
  previous/next month.
- Events for the visible month are loaded from `GET /api/v1/events` (paginated, 25/page)
  and rendered on their day(s); all-day events are visually distinct from timed events.
- Clicking a day or an empty slot opens a create form; submitting issues
  `POST /api/v1/events` and the new event appears without a full page reload.
- Clicking an existing event opens an edit form pre-filled with its values; saving issues
  `PUT /api/v1/events/{id}` (full replacement) and updates the view.
- An event can be deleted via `DELETE /api/v1/events/{id}` with a confirmation step;
  it disappears from the grid on success.
- Datetimes are displayed in the user's local timezone but sent/received as ISO 8601 UTC
  (trailing `Z`); `all_day` events use the date-only display.
- API errors surface a non-blocking message; a `401` redirects to login.
- Loading and empty states are shown (e.g. "No events this month").
- The module is minimalist: no recurrence, attendees, reminders, colours or multiple
  calendars.
