---
sprint: Landing Page and Login
stories:
  - 08-landing-page-and-login
status: done
created: 2026-06-24
---

## Goal

Give coevta its first web (HTML) surface and a credential login. Today it is backend-only
(JSON + artisan-minted tokens); this sprint adds a minimal Blade landing page and login
screen using session auth, plus a JSON token-issuing login endpoint for API clients — two
front doors over the same credentials. It is the foundation any human-facing access will
build on.

## Locked decisions

- **Two guards, same credentials**:
  - **Web** uses the existing `web` session guard (`Auth::attempt()` + session + CSRF).
    The web/session/CSRF stack is already wired (`routes/web.php`, `config/session.php`,
    `welcome.blade.php`), so **no `bootstrap/app.php` changes are needed**.
  - **API** uses a **token-issuing** endpoint that returns a Sanctum personal access token
    via `$user->createToken()` — the same pattern as the `coevta:create-token` command.
- **Controllers** (thin, matching the flat `app/Http/Controllers` convention):
  - `PageController` — `landing()` (public `/`), `dashboard()` (auth-only).
  - `LoginController` — web `showLogin()` / `login()` / `logout()` (session).
  - `ApiLoginController` — `login()` / `logout()` (token).
- **Validation**: a shared `LoginRequest` FormRequest (email required+email, password
  required). Field validation failures render as HTML redirect-back on web and JSON `422`
  on `api/*` (the existing `shouldRenderJsonWhen(api/*)` gate already does this).
- **Auth failure is NOT defaulted**: wrong credentials must fail (the "minimize computer
  says no" principle explicitly does not apply to auth). Web → redirect back with a
  generic error + old email; API → `401` JSON, no token. Error messages must not reveal
  whether the email exists.
- **Throttling**: login routes (web `POST /login` and `POST /api/v1/login`) get
  `throttle:6,1` so repeated failures return `429`.
- **Route naming**: the web login route is named `login` so the framework `auth`
  middleware redirects guests there.
- **Session safety**: regenerate the session on successful web login; invalidate +
  regenerate token on logout. API logout revokes the current access token only.
- **Views**: minimal, intentionally unstyled Blade (`landing`, `login`, `dashboard`, a
  shared layout). Visual polish is a later story (frontend-design).

## Surface

### Web (session guard)

- `GET /` — public landing page.
- `GET /login` — login form (named `login`); redirects authenticated users to `/dashboard`.
- `POST /login` — `Auth::attempt()`; success → regenerate session, redirect intended/
  `/dashboard`; failure → redirect back with error + old email. `throttle:6,1`.
- `POST /logout` — invalidate session, redirect `/` (auth-only).
- `GET /dashboard` — authenticated placeholder ("you are logged in"); guests → `/login`.

### API (token guard, under `/api/v1`)

- `POST /api/v1/login` — `{ email, password }` → `200 { token }`; bad creds → `401`;
  missing fields → `422`. `throttle:6,1`.
- `POST /api/v1/logout` — `auth:sanctum`; revokes the current token, returns `204`/`200`.

## Acceptance Criteria

- [ ] `GET /` returns `200` HTML for a guest (no auth).
- [ ] `GET /login` renders the login form; an authenticated session is redirected to
      `/dashboard`.
- [ ] `POST /login` with valid credentials authenticates the session (session regenerated)
      and redirects to `/dashboard`; `assertAuthenticated()` holds afterward.
- [ ] `POST /login` with invalid credentials does **not** authenticate (`assertGuest()`),
      redirects back with an error, and does not disclose whether the email exists.
- [ ] `GET /dashboard` returns `200` for an authenticated session and redirects guests to
      `/login`.
- [ ] `POST /logout` ends the session; `/dashboard` then redirects to `/login`.
- [ ] `POST /api/v1/login` with valid credentials returns `200` with a token; that token
      authenticates a subsequent `auth:sanctum` request (e.g. `GET /api/v1/user`).
- [ ] `POST /api/v1/login` with invalid credentials returns `401` with a generic message
      and no token; missing fields return `422`.
- [ ] `POST /api/v1/logout` revokes the calling token; reusing that token afterward returns
      `401`.
- [ ] Both login routes are rate-limited: exceeding the limit returns `429`.
- [ ] `composer gates` passes (style, PHPStan max, PHPUnit, coverage ≥90%, audit).

## Tasks

- [ ] Write tests `tests/Feature/WebAuthTest.php`: landing guest `200`; login form renders;
      authed user redirected off `/login`; valid login authenticates + redirects; invalid
      login stays guest + error; dashboard auth `200` / guest redirect; logout ends session.
- [ ] Write tests `tests/Feature/ApiAuthTest.php`: valid login returns token; token works on
      a protected route; invalid creds `401` no token; missing fields `422`; logout revokes
      token (reuse `401`); throttle returns `429`.
- [ ] Implement `LoginRequest` FormRequest (shared rules).
- [ ] Implement `PageController` (`landing`, `dashboard`) + `landing`/`dashboard` Blade views
      and a shared layout.
- [ ] Implement `LoginController` (web `showLogin`/`login`/`logout`) + `login` Blade view;
      session regenerate on login, invalidate on logout.
- [ ] Implement `ApiLoginController` (`login` issuing a Sanctum token, `logout` revoking the
      current token).
- [ ] Wire `routes/web.php` (landing, login, logout, dashboard with `auth`/`guest` +
      `throttle:6,1`, login route named `login`) and `routes/api.php`
      (`POST /api/v1/login` throttled, `POST /api/v1/logout` under `auth:sanctum`).
- [ ] Update `docs/system.md`: document the web layer and the login endpoints (web session
      + API token), and that auth is exempt from the defaulting principle.

## Risks and Open Questions

- **Scope expansion** (accepted): this adds the first HTML/web layer to a backend that
  CLAUDE.md frames as JSON-only and embeddable. Kept deliberately thin (no styling, no SPA).
- **User provisioning still external**: there is no registration — users come from
  `coevta:create-token` (or the future [06-user-management]). The login screen is only
  useful once a user exists; note this in docs. Decide later whether `08` should ship
  before or after `06`/registration.
- **Generic auth errors vs UX**: messages must not leak email existence; keep them generic
  on both web and API.
- **Coverage**: Blade views carry no executable statements; ensure controller branches
  (success/failure/guest/throttle) are all exercised to stay ≥90%.
- **Styling deferred**: landing copy and visual design are placeholders here; a
  frontend-design pass is a separate story.
