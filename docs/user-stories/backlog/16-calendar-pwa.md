---
story: Calendar PWA
created: 2026-07-15
---

## Description

Ship the calendar as its own installable PWA at `/calendar/`, the second of three separate
apps (contacts, calendar, tasks). The backend is complete and must not change.

The Contacts PWA established the pattern — see the "Contacts PWA" section of
`docs/system.md` before starting. This story reuses it rather than reinventing it:
`resources/shared/lib/` (api, auth, kv), the offline store/outbox/sync design, one Vite
config per app, a hand-written service worker scoped to the app's own path, and a static
committed shell.

The existing `CalendarView` in the legacy SPA is the starting point for the UI, but the
data layer moves to the offline store.

Two things are genuinely different from contacts and need thought rather than copying:

- **The offline store is currently contacts-shaped.** `store.js` hardcodes the contacts
  remote and sorts with the contacts alphabet helpers. Generalising it (a resource-agnostic
  store the three apps parameterise) is the point of doing this second app — but only
  generalise what two apps actually share.
- **The calendar fetches all events and groups them by day**, because the Events API has no
  date filter. That is fine offline (the set is already local) but the full-set pull grows
  without bound over time, unlike contacts.

## Acceptance Criteria

- Installable at `/calendar/`: manifest with `scope`/`start_url` of `/calendar/`, `display: standalone`, icons, and a service worker precaching its shell
- The service worker's cache name and scope do not collide with the contacts app
- The app has its own login view inside `/calendar/` — it never navigates out of scope
- The month grid, event create/edit/delete and the prev/next/today controls work with no network
- Offline writes queue in a durable outbox and sync when the connection returns, with the same failure policy as contacts (401 keeps the queue, 404 reconciles, 422 drops and reports, transient retries in order)
- Events created offline get a temporary id that is remapped when the create syncs
- Connection state and the pending-change count are visible
- The shared offline machinery is genuinely shared with contacts, not copy-pasted — one outbox and one sync engine in the repo
- `GET /calendar` deep links resolve; static files under `/calendar/` are not swallowed by the catch-all
- The legacy SPA's `/calendar` route and nav link point at the new PWA
- Unit and component tests cover the calendar-specific logic; `composer gates` and `npm test` pass
- No backend changes
