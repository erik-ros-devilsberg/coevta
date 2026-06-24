---
story: Vue SPA dashboard with client-side token auth
created: 2026-06-24
---

## Description

Build the authenticated app as a **Vue SPA** served as a static build — **no server-side
rendering**. The SPA is the only place users log in and work; it talks to the JSON API
(`/api/v1/*`) using a Sanctum bearer token held client-side.

This replaces the session-based Blade login + dashboard shipped in
[08-landing-page-and-login]: those SSR pages are removed and auth moves fully client-side.
The SPA also hosts the password-reset **form** that consumes the link produced by the
password-reset API ([09-password-reset]).

The SPA should be reachable from the static landing page ([10-devilsberg-style-dark-theme])
and share its Devilsberg dark styling (the central, function-split CSS).

## Scope

- Add a Vue + Vite build (Vue dependency, Vite plugin) producing a static SPA bundle.
- A static shell (built HTML, **not** a Blade view) that boots the SPA; the server only
  serves the static file(s) and the API. SPA deep links (e.g. the reset route) resolve to
  the same static entry — via static file serving / a catch-all that returns the file, not
  a rendered view.
- **Login view**: Vue form → `POST /api/v1/login` → stores the returned token; failures
  show the generic error. Authenticated requests send the token; logout calls
  `POST /api/v1/logout` and clears it.
- **Dashboard view**: minimal authenticated landing for the SPA (e.g. shows the current
  user from `GET /api/v1/user`); a place later resource UIs hang off.
- **Password-reset view**: reads `token` + `email` from the URL and POSTs them with the new
  password to `POST /api/v1/reset-password`; on success routes to login.
- Remove the Blade login + dashboard views, `LoginController` web routes, and the session
  auth web routes; keep only what serves the static frontend and the API.

## Decisions (from shaping)

- Auth is **token-based, client-side** (Sanctum personal access token via `POST
  /api/v1/login`). No session/cookie auth for the app.
- Framework is **Vue**.
- Styling reuses the Devilsberg central CSS from story 10 — no new design system.

## Open questions to fine-tune

- **Token storage**: `localStorage` vs in-memory + refresh. Default: `localStorage` for
  simplicity (note the XSS trade-off); revisit if SPA-cookie/Sanctum-SPA mode is wanted.
- **Routing**: history mode (needs the static catch-all) vs hash mode (no server config).
  Default: history mode with a catch-all returning the static entry.
- **SPA tests**: introduce a JS test runner (Vitest) or rely on Laravel feature tests for
  the API + a smoke test that the static entry is served? Default: API stays covered by
  PHPUnit; add a minimal Vitest setup for the auth/reset view logic.

## Out of scope

- Resource management UIs for contacts/events/tasks (later stories).
- Any server-side rendering, SSR hydration, or Blade templating.
- Social login, MFA, refresh-token rotation.

## Acceptance Criteria

- The dashboard is a Vue SPA served as a **static** build; no Blade view is rendered for
  it, and the Blade login/dashboard views + session-auth web routes are removed.
- The SPA login form authenticates via `POST /api/v1/login`, stores the token, and uses it
  for authenticated API calls; bad credentials show the generic failure; logout clears the
  token and calls `POST /api/v1/logout`.
- The password-reset view reads `token`/`email` from the URL and completes a reset via
  `POST /api/v1/reset-password`, then sends the user to login.
- SPA deep links (login, reset, dashboard) resolve to the static entry without a 404 and
  without server-side rendering.
- The SPA uses the Devilsberg central CSS (story 10); no separate styling system.
- `npm run build` produces the static SPA bundle; the JS view logic for login/reset has at
  least smoke-level tests; `composer gates` passes (API + backend coverage ≥90%).
