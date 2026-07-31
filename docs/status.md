# Sprint Status

Maintained by the agile plugin. One row per sprint — updated by `/agile:shape`, `/agile:execute`.

| Sprint | Slug | Status | Description |
|--------|------|--------|-------------|
| Project Foundation & Quality Tooling | project-foundation-and-quality-tooling | done | Laravel skeleton, Sanctum auth, UUID v7, REST conventions, PHPStan/PHP-CS-Fixer/coverage guardrails. |
| Contacts REST API | contacts-rest-api | done | Google-compatible Contacts entity with full CRUD under /api/v1/contacts, Sanctum-protected. |
| Events REST API | events-rest-api | done | Google Calendar-compatible Events entity with full CRUD under /api/v1/events; no recurrence/status. |
| Tasks REST API | tasks-rest-api | done | Google Tasks-compatible Tasks entity with full CRUD under /api/v1/tasks; completion via completed_at, flexible due_at. |
| Per-User Entity Ownership | per-user-entity-ownership | done | Bind contacts/events/tasks to an owning user; queries scoped to the token, cross-user access 404s. |
| Landing Page and Login | landing-page-and-login | done | Blade landing + session login screen and a JSON token-issuing login/logout endpoint. |
| Password Reset API and Static Landing | password-reset-api-and-static-landing | done | API password-reset flow plus a static Devilsberg-dark landing page; no SSR, split CSS. |
| Vue SPA Dashboard and Client-Side Auth | vue-spa-dashboard-and-auth | done | Static Vue SPA dashboard with token login and reset view; removes Blade SSR auth. |
| SPA Contacts Module & App Shell | spa-contacts-module | done | Contacts CRUD in the SPA plus the shared authenticated nav shell and CRUD UI patterns. |
| SPA To-Do Module | spa-todo-module | done | Tasks module with quick-add, complete action, and the shared local-timezone datetime util. |
| SPA Calendar Module | spa-calendar-module | done | Minimalist month-view calendar with event create/edit/delete over the Events API. |
| Contacts PWA Foundation and Offline Reads | contacts-pwa-foundation | done | Installable contacts PWA at /contacts with offline reads, shared libs and an A–Z scrubber. |
| Contacts Offline Writes and Sync Queue | contacts-offline-writes-and-sync | done | Offline create/edit/delete via a durable outbox with temp-id remap and last-write-wins sync. |
| Tasks PWA and Shared Offline Layer | tasks-pwa-and-shared-offline-layer | done | Installable offline-first tasks PWA at /tasks, on a generalised shared offline layer. |
| Calendar PWA | calendar-pwa | done | Installable offline-first calendar PWA at /calendar, the third app on the shared layer. |
