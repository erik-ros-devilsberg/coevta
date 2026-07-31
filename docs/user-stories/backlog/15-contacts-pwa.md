---
story: Contacts PWA (offline-first)
created: 2026-07-15
---

## Description

Pivot the launch to a single, installable **Contacts PWA**, served at `/contacts/`.
The backend is complete and **must not change** — the PWA is a client of the existing
`/api/v1/contacts` endpoints.

The repo is structured so that Calendar and Tasks can later ship as **separate PWAs**
(`/calendar/`, `/tasks/`), each independently installable, reusing a shared library
layer. This story builds that structure and ships Contacts on it; the other two apps
are separate stories.

Two constraints drive the design:

1. **Separate apps, separate scopes.** A service worker's scope is bounded by its path,
   and navigations outside that scope escape the installed app window into a browser
   tab. So each PWA must be self-contained within its own path prefix — including its
   own login view. Apps share an origin, so the Sanctum token in localStorage is shared:
   log in once, all apps are authenticated.

2. **Offline-first, not offline-tolerant.** The app reads and writes while offline and
   syncs when the connection returns. The API has no sync, ETag or `updated_at` support
   and is not changing, so conflict resolution is necessarily **last-write-wins**. This
   is an accepted, documented trade-off, not an oversight.

Because the full contact set lives on the device for offline use, the list is rendered
and searched **client-side** — server pagination disappears from the UI. This is also
what makes the A–Z scrubber meaningful, since it can only jump between letters that are
actually loaded.

**Styling is deliberately minimalist.** Devilsberg branding, iconography and visual
design are explicitly **out of scope** — a separate branding sprint follows. Icons and
the wordmark ship as neutral placeholders.

## Acceptance Criteria

### Installable PWA

- `GET /contacts/` and any deep link under it serve the contacts app shell; deep links resolve instead of 404ing
- A web app manifest is served with `scope: /contacts/`, `start_url: /contacts/`, `display: standalone`, a name, a short name and icons — such that the app is installable to the home screen
- A service worker registered at `/contacts/sw.js` precaches the app shell (HTML, JS, CSS, icons) and serves it cache-first, so the app opens with no network
- The service worker never caches `/api/v1/*` responses — API data is owned by the offline data layer, not the HTTP cache
- A new service worker version takes over without leaving stale assets behind (old caches are cleaned on activate)
- The existing static landing page at `GET /` is unchanged

### Self-contained auth

- The PWA has its own login view **inside its scope**, so an installed app never escapes to a browser tab to authenticate
- Login reuses the shared auth library against `POST /api/v1/login`; the token is shared with any other app on the origin
- An unauthenticated visit to a protected route redirects to the in-scope login
- Attempting to log in while offline reports that a connection is required, rather than failing silently
- A `401` from the API clears the token and returns the user to the in-scope login

### Offline reads

- On first online load the app pages through the full contact set and stores it locally in IndexedDB
- On subsequent loads the list renders from local storage immediately, then refreshes from the network in the background when online
- With no network the app opens, lists, searches and reads contact detail from local data
- Connection state (online / offline) is visible in the UI
- Storage is abstracted behind a small async key-value interface, so the sync logic is testable without a browser IndexedDB

### Offline writes and sync queue

- Create, edit and delete all work while offline: the change is applied to local data immediately and queued in a durable outbox
- Queued changes survive a full app restart (the outbox is persisted, not in-memory)
- The outbox flushes automatically when the app starts online and when the connection returns
- A contact created offline gets a temporary local id; when its create syncs, the record is replaced by the server's version and **any queued operations still referencing the temporary id are remapped to the real server id**
- Create-then-delete while offline cancels both operations — nothing is sent to the server for a record that never existed there
- Repeated edits to the same record while offline coalesce to the last value rather than replaying every keystroke
- A queued update or delete for a record the server no longer has (`404`) drops the operation and reconciles local state, without blocking the rest of the queue
- A queued operation the server rejects as invalid (`422`) is dropped from the queue and surfaced to the user rather than retrying forever and blocking the queue
- A network failure mid-flush leaves the operation queued for the next attempt
- The number of pending (unsynced) changes is visible in the UI
- Conflict resolution is last-write-wins, and this is documented in `docs/system.md`

### A–Z scrubber

- A horizontal scrubber is pinned to the bottom of the contacts list, running **A on the left to Z on the right**
- Dragging or clicking along the scrubber jumps the list to the first contact under that letter
- The scrubber works by pointer, touch and keyboard, and exposes an accessible name and the active letter to assistive tech
- Letters with no contacts are visually distinguished from letters that have them
- Contacts whose name does not start with a letter group under a `#` bucket
- The letter currently at the top of the list is reflected as active on the scrubber as the user scrolls
- Grouping and sorting are case- and accent-insensitive, so `Ålund` and `alund` land under `A`

### Quality

- The offline data layer, sync queue and scrubber index logic are covered by unit tests (Vitest)
- The contacts views are covered by component tests (Vitest)
- The shell/manifest/service-worker routes are covered by PHPUnit feature tests
- `composer gates` passes and `npm test` passes
- No backend code changes (`app/`, `database/`, `routes/api.php` untouched)
