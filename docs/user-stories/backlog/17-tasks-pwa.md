---
story: Tasks PWA
created: 2026-07-15
---

## Description

Ship tasks as its own installable PWA at `/tasks/`, the third of three separate apps
(contacts, calendar, tasks). The backend is complete and must not change.

Follows the pattern set by the Contacts PWA and generalised by the Calendar PWA — read the
"Contacts PWA" section of `docs/system.md` first. The existing `TasksView` in the legacy
SPA is the starting point for the UI.

**Once this ships, the legacy SPA has nothing left.** Deleting it is part of this story:
`resources/spa/`, its Vite config and build script, `public/app.html`, and the
`/dashboard`, `/login`, `/reset-password` routes all need a decision rather than being
left to rot. Note that `/reset-password` is a real dependency: password reset emails link
to it (`AppServiceProvider` builds the URL from `app.frontend_url`), so it cannot simply be
deleted — it needs a home, most likely inside whichever app owns login.

One task-specific wrinkle for the offline layer: the API's PUT is a full replacement, so
**omitting `completed_at` reopens a task**. The outbox's coalescing must not drop it from a
queued update.

## Acceptance Criteria

- Installable at `/tasks/`: manifest scoped to `/tasks/`, `display: standalone`, icons, and a service worker precaching its shell; no cache or scope collision with the other apps
- The app has its own login view inside `/tasks/` — it never navigates out of scope
- Quick-add, complete/reopen, edit and delete all work with no network
- Offline writes queue and sync with the same failure policy as the other apps
- A task completed offline round-trips correctly — `completed_at` is preserved through coalescing and full-replacement PUTs, and a task does not silently reopen
- Connection state and the pending-change count are visible
- `GET /tasks` deep links resolve; static files under `/tasks/` are not swallowed by the catch-all
- The legacy SPA is removed: `resources/spa/`, `public/app.html`, its Vite config and build script
- Password reset still works end to end — the URL in the reset email resolves to a live view
- The dashboard is either rehomed or deliberately dropped, with the decision recorded in `docs/system.md`
- Unit and component tests cover the task-specific logic; `composer gates` and `npm test` pass
- No backend changes
