---
sprint: SPA Calendar Module
stories:
  - 12-spa-calendar-module
status: planned
created: 2026-06-24
---

## Goal

Add a minimalist calendar module to the SPA: a single month view plus a simple
create/edit/delete form over the existing Events API. Reuses the app shell (Contacts
sprint) and the local-timezone datetime util (To-Do sprint). Sleek, on the Devilsberg dark
brand — the most UI-heavy of the three modules, kept deliberately small.

## Decisions (from shaping)

- **Depends on the Contacts sprint** (app shell / nav / confirm-delete) **and the To-Do
  sprint** (`lib/datetime.js`).
- **One month grid only** — no week/day/agenda views, no recurrence, attendees, reminders,
  colours or multiple calendars (those map to fields the API does not carry).
- **No backend changes** beyond serving the SPA shell at `/calendar`.
- Styling stays central (Devilsberg tokens, BEM); JS logic tested with `node --test`.

## Design direction (Devilsberg, minimalist)

- A clean 7-column month grid on Onyx; thin Blue Slate cell borders; today's cell marked
  with a subtle Hot Fuchsia accent (ring or dot), not a fill. Lemon Milk for the
  month/weekday labels (uppercase, letter-spaced); Open Sans for event chips.
- Event chips are small and quiet: timed events show a leading time, all-day events are a
  full-width bar — visually distinct but understated (Gray Mid / Blue Slate), no per-event
  colours. Overflow days show a "+N more" affordance.
- Prev/next month via slim icon buttons; "Today" returns to the current month. The
  create/edit form is the shared form style (Devilsberg `.form`), not a heavy modal.

## Acceptance Criteria (maps to story 12)

- [ ] A month grid renders the current month and highlights today; users can page to the
      previous/next month (and jump back to today).
- [ ] Events for the visible month load from `GET /api/v1/events` (paginated, 25/page) and
      render on their day(s); all-day events are visually distinct from timed events.
- [ ] Clicking a day / empty slot opens a create form; submit issues `POST /api/v1/events`
      and the event appears without a full reload.
- [ ] Clicking an event opens an edit form pre-filled with its values; saving issues
      `PUT /api/v1/events/{id}` (full replacement) and updates the grid.
- [ ] Delete via `DELETE /api/v1/events/{id}` behind a confirm step; it disappears on success.
- [ ] Datetimes display in the user's local timezone but send/receive ISO 8601 UTC (`Z`);
      `all_day` events use date-only display and honour the API's `all_day` handling.
- [ ] API errors surface a non-blocking message; a `401` redirects to `/login`.
- [ ] Loading and empty states are shown ("No events this month").
- [ ] Minimalist: no recurrence, attendees, reminders, colours or multiple calendars.

### Quality

- [ ] `lib/events.js` has Node tests (list/create/update/delete calls + payload shape,
      including `all_day` and UTC datetimes), reusing `lib/datetime.js`.
- [ ] A small month-grid helper (build the weeks/day cells for a given month) is pure and
      unit-tested with `node --test`.
- [ ] `routes/web.php` serves the SPA shell at `/calendar` (with a `SpaServingTest` case);
      the router has a `requiresAuth` `/calendar` route; deep-linking resolves.
- [ ] `npm run build` succeeds; `npm test` passes; `composer gates` passes.

## Tasks

- [ ] Add a pure `lib/month.js` (compute the grid: leading/trailing days, today flag, group
      events onto days) + Node tests first, then implement.
- [ ] Add `lib/events.js` (list/get/create/update/remove over `apiFetch`, using
      `lib/datetime.js`) + Node tests first, then implement.
- [ ] Add `CalendarView.vue`: month grid, prev/next/today controls, event chips
      (timed vs all-day), day/empty-slot click → create, event click → edit; reuse the shell
      nav + confirm modal + shared form styling.
- [ ] Register the `/calendar` route (`requiresAuth`); serve the shell at `/calendar` in
      `routes/web.php`; add a `SpaServingTest` case.
- [ ] Extend `public/css/` minimally for the month grid + event chips (Devilsberg tokens,
      AA contrast, 768px responsive — stack/scroll gracefully on small screens).
- [ ] Run `npm test`, `npm run build`, `composer gates`; fix any failures.

## Risks and Open Questions

- **Month-spanning / all-day events**: rendering an event across day cells can get fiddly —
  keep it minimal (chip on each covered day, or start-day only with a span bar) and isolate
  the day-mapping logic in the tested `lib/month.js`.
- **Pagination vs a busy month**: a month could exceed 25 events/page; the loader must page
  through `GET /api/v1/events` until the month is covered (or filter client-side). Decide at
  execute; keep it simple.
- **Timezone edges**: all-day vs timed display must use `lib/datetime.js` consistently so a
  late-evening UTC event lands on the correct local day.
- **Depends on the Contacts and To-Do sprints**.
