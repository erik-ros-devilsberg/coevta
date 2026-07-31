---
sprint: Contacts PWA Foundation and Offline Reads
stories:
  - 15-contacts-pwa
status: in-progress
created: 2026-07-15
---

## Goal

Ship the launch pivot: a self-contained, installable Contacts PWA at `/contacts/` that
opens and reads with no network. This sprint establishes the multi-app repo structure and
the shared library layer that Calendar and Tasks will later reuse as their own PWAs, and
delivers the read side end to end — install, in-scope login, offline list/search/detail,
and the A–Z scrubber. Writes stay online-only here and move onto the sync queue in the
next sprint, so this sprint is independently shippable.

The backend is complete and must not change.

## Acceptance Criteria

### Structure and build

- [x] Shared, framework-free libraries live in `resources/shared/lib/` and are imported by both the existing SPA and the contacts PWA — there is exactly one `api.js` and one `auth.js` in the repo
- [x] The contacts PWA source lives under `resources/pwa/contacts/` and builds via its own Vite config to `public/contacts/app.js` with a stable, unhashed filename
- [x] `npm run build` builds both the existing SPA and the contacts PWA
- [x] Build artifacts under `public/contacts/` are gitignored; the shell, manifest and service worker are committed static files
- [x] The existing SPA (`/dashboard`, `/tasks`, `/calendar`, `/login`, `/reset-password`) still builds and works; its `/contacts` route and nav link now point at the new PWA
- [x] `vitest.config.js` picks up tests under `resources/**/*.test.js`

### Installable PWA

- [x] `GET /contacts` and any deep link under `/contacts/` serve the contacts app shell; deep links resolve instead of 404ing
- [x] `GET /contacts/manifest.webmanifest` serves a manifest with `scope: "/contacts/"`, `start_url: "/contacts/"`, `display: "standalone"`, `name`, `short_name` and icons, such that the app is installable
- [x] A service worker at `/contacts/sw.js` precaches the app shell (HTML, JS, CSS, icons) and serves it cache-first, so the app opens with no network
- [x] The service worker never caches `/api/v1/*` — API data is owned by the offline data layer, not the HTTP cache
- [x] On `activate`, caches from previous service worker versions are deleted
- [x] Static files under `/contacts/` (`sw.js`, `manifest.webmanifest`, `app.js`) are served as themselves and are not swallowed by the shell catch-all route
- [x] `GET /` still serves the unchanged static landing page

### Self-contained auth

- [x] The PWA has its own login view at `/contacts/login`, inside its own scope, so an installed app never escapes to a browser tab to authenticate
- [x] Login reuses the shared auth library against `POST /api/v1/login`; the token is shared with any other app on the origin
- [x] An unauthenticated visit to a protected route redirects to `/contacts/login`
- [x] Attempting to log in while offline reports that a connection is required, rather than failing silently
- [x] A `401` from the API clears the token and returns the user to `/contacts/login`

### Offline reads

- [x] Storage is abstracted behind a small async key-value interface with two implementations: an IndexedDB adapter for the browser and an in-memory one for tests — no new npm dependencies
- [x] On first online load the app pages through the full contact set and stores it locally
- [x] On subsequent loads the list renders from local storage immediately, then refreshes from the network in the background when online
- [x] With no network the app opens, lists, searches and reads contact detail from local data
- [x] The list is rendered, searched and sorted client-side from the full local set — server pagination is gone from the UI
- [x] Connection state (online / offline) is visible in the UI and updates live on `online`/`offline` events
- [x] Create, edit and delete work online (direct API calls, refreshing local storage); while offline they are disabled with a clear explanation — the sync queue arrives next sprint

### A–Z scrubber

- [x] A horizontal scrubber is pinned to the bottom of the contacts list, running A on the left to Z on the right
- [x] Clicking or dragging along the scrubber jumps the list to the first contact under that letter
- [x] The scrubber responds to pointer, touch and keyboard (arrow keys move between letters), and exposes an accessible name and the active letter to assistive tech
- [x] Letters with no contacts are visually distinguished from letters that have them
- [x] Contacts whose name does not start with a letter group under a `#` bucket, sorted after `Z`
- [x] The letter at the top of the viewport is reflected as active on the scrubber as the user scrolls
- [x] Grouping and sorting are case- and accent-insensitive, so `Ålund` and `alund` both land under `A`

### Quality

- [x] Unit tests (Vitest) cover the storage adapter contract, the offline read/cache logic and the scrubber index logic (grouping, sorting, accent folding, `#` bucket, position→letter mapping)
- [x] Component tests (Vitest) cover the contacts list view (renders from cache, offline state, scrubber interaction) and the login view
- [x] PHPUnit feature tests cover the shell, manifest and deep-link routes
- [x] `composer gates` passes and `npm test` passes
- [x] No backend changes — `app/`, `database/` and `routes/api.php` are untouched

## Tasks

- [x] Move `api.js`, `auth.js` (and their tests) to `resources/shared/lib/`; repoint existing SPA imports; update `vitest.config.js` include glob
- [x] Write tests for the key-value storage contract (memory + IDB adapters share one test suite)
- [x] Implement `shared/lib/kv.js` — async `get`/`set`/`del`/`all`/`clear` over IndexedDB, plus `memoryKv()` for tests
- [x] Write tests for the contacts offline read cache (hydrate-from-local, background refresh, full paging)
- [x] Implement `shared/lib/contacts.js` (`listAllContacts` paging through) and `pwa/contacts/lib/store.js` (local-first read layer)
- [x] Write tests for the scrubber index (sort, group, accent folding, `#` bucket, letter↔position mapping)
- [x] Implement `pwa/contacts/lib/alphabet.js` — pure index/scrub helpers
- [x] Implement `AlphabetScrubber.vue` — horizontal, bottom-pinned, pointer/touch/keyboard, active-letter feedback
- [x] Write component tests for `ContactsListView` and `ContactsLoginView`
- [x] Implement the PWA app: `main.js`, `App.vue`, `router.js` (base `/contacts/`), login/list/detail/form views, online-state banner
- [x] Write `public/contacts/index.html` shell, `manifest.webmanifest`, placeholder icons and `sw.js` (precache + cache-first + activate cleanup, API bypass)
- [x] Add `vite.contacts.config.js`; update `npm run build`; gitignore `public/contacts` build artifacts
- [x] Update `routes/web.php` — `/contacts` + `/contacts/{any}` serve the PWA shell; write PHPUnit feature tests; update `SpaServingTest`
- [x] Remove `ContactsView` from the old SPA router; repoint the NavBar contacts link at `/contacts`
- [x] Run `composer gates` and `npm test`; fix until green

## Execution notes

Delivered. `composer gates` passes (156 PHP tests, 100% line coverage) and `npm test`
passes (149 JS tests across 16 files). `npm run build` builds both apps.

Deviations and gaps worth knowing about, rather than buried:

- **The manifest is asserted as a file, not over HTTP.** It is a committed static file
  served by the web server, so there is no Laravel route to hit — `ContactsPwaManifestTest`
  asserts its contents (scope, start_url, display, icons exist, maskable present) directly.
  The catch-all-shadowing risk is covered separately in `ContactsPwaServingTest`.
- **The scroll spy is not unit-tested.** It uses `IntersectionObserver`, which jsdom does
  not implement; the code is guarded so it simply does not run under test. Everything else
  about the scrubber (pointer drag, keyboard, click, empty-letter skip, accent folding) is
  covered. This is the one part of the sprint verified by reading rather than by test.
- **The IndexedDB adapter is not unit-tested** for the same reason — no IndexedDB in jsdom,
  and adding `fake-indexeddb` was ruled out (no new dependencies). It is deliberately thin
  and holds no logic; the storage *contract* is tested against the memory adapter, which
  is what the sync logic in the next sprint will run against.
- **`ContactDetailView` has no component test.** The sprint scoped component tests to the
  list and login views; the detail view's logic is a single `store.get` call, already
  covered at the store level.
- **`ConfirmDialog` also moved to `resources/shared/components/`.** Not in the plan, but the
  PWA needed it and duplicating it would have left two copies to drift apart.
- **Nothing has been driven in a real browser.** Install, offline reload and service worker
  activation are covered by tests of their inputs (manifest contents, precache list, route
  serving), not by an actual install. Worth doing once by hand before launch.

## Risks and Open Questions

- **Icons are placeholders.** Branding is explicitly out of scope (a separate branding sprint follows), so icons ship as neutral SVGs. SVG manifest icons satisfy Chromium installability but **iOS/Safari prefers PNG** — if iOS home-screen install matters at launch, the branding sprint must supply PNG icons at 192px and 512px.
- **The catch-all route must not shadow real files.** `/contacts/{any}` serving the shell would break `sw.js`/`manifest.webmanifest` if PHP handled them. Both `artisan serve` and the production web server serve existing public files first, but this is asserted by test rather than assumed.
- **Service worker scope is the reason for the whole structure.** A navigation outside `/contacts/` from an installed app opens a browser tab. Any link added to the PWA that points outside its scope silently breaks the standalone experience.
- **Two frontends coexist during the transition.** The old SPA keeps `/dashboard`, `/tasks`, `/calendar`; the PWA owns `/contacts`. Moving between them is a full page load. This is intentional and resolves when Tasks and Calendar become PWAs and the old SPA is deleted.
- **Precache list is hand-maintained.** Assets use stable unhashed names, so `sw.js` lists them literally. Adding an asset means updating the list and bumping the cache version — noted in `docs/system.md`.
