---
story: Landing page and login screen
created: 2026-06-24
---

## Description

Add a minimal **web (HTML) layer** to coevta: a public landing page and a login screen,
plus a JSON login endpoint for API clients. Today coevta is backend-only — REST/JSON with
Sanctum tokens minted via the `coevta:create-token` artisan command and no HTML at all.
This story introduces the first server-rendered pages and a credential-based login.

> **Scope note**: this deliberately steps outside the original "embeddable backend, JSON
> only" scope (see CLAUDE.md). It adds Blade views, web (session) routes, and CSRF. Keep
> the UI intentionally minimal — it is a thin shell over the existing API, not a full SPA.

## Two front doors, same credentials

- **Blade (browser)** uses standard Laravel **session** auth (`Auth::attempt()` + the
  session guard + CSRF). Browsers navigating HTML pages cannot carry a Bearer token, so the
  web side is stateful/cookie-based.
- **API (clients)** uses a **token-issuing** endpoint: `POST /api/v1/login` validates
  credentials and returns a Sanctum personal access token (Bearer), consistent with the
  current token model.

## Proposed surface (fine-tune at shape time)

### Web (Blade, session guard)

- `GET /` — public landing page (product blurb + link/button to log in).
- `GET /login` — login form (email + password). Redirects to the dashboard if already
  authenticated.
- `POST /login` — `Auth::attempt()`; on success regenerate the session and redirect to a
  post-login page; on failure redirect back with an error and the old email input.
- `POST /logout` — invalidate the session, redirect to `/`.
- `GET /dashboard` (or similar) — a minimal authenticated landing target proving session
  auth works (can be a placeholder "you are logged in" page).

### API (JSON, token guard)

- `POST /api/v1/login` — `{ email, password }` → `200 { token: <plaintext> }` on success;
  `422`/`401` on bad credentials. Issues a Sanctum token via `user->createToken()`.
- `POST /api/v1/logout` — revokes the current access token (`auth:sanctum`).

## Design principles to honor

- **Minimize "computer says no"** does **not** apply to credentials — wrong email/password
  is a genuine "cannot interpret" case and must fail (no defaulting around auth).
- Generic auth error messages (do not reveal whether the email exists).
- Throttle login attempts (Laravel's `throttle` middleware / rate limiter) on both the web
  and API login routes.

## Open questions to fine-tune

- **Visual design**: how much styling? Default: minimal, semantic HTML with the project's
  existing CSS approach (or none). Frontend-design polish can be a later story.
- **Registration**: out of scope here? Default: yes — login only; user creation stays with
  the artisan command / the future user-management story ([06-user-management]).
- **Landing content**: real marketing copy vs placeholder? Default: short placeholder
  describing coevta; copy can be refined later (see [[devilsberg-brand]] if brand-aligned).
- **Post-login destination**: dashboard placeholder vs a real screen. Default: placeholder.
- **CSRF / session config**: confirm `web` middleware group and session driver are wired
  (the minimalist skeleton may need the session/web stack enabled in `bootstrap/app.php`).

## Out of scope

- Registration / sign-up, password reset, email verification, "remember me", OAuth/social
  login, MFA, a full styled marketing site, any SPA framework.

## Acceptance Criteria

- `GET /` returns `200` HTML for guests (no auth required).
- `GET /login` shows a login form; an already-authenticated browser session is redirected
  away from it.
- `POST /login` with valid credentials starts an authenticated session (session
  regenerated) and redirects to the post-login page; with invalid credentials it redirects
  back with a validation/auth error and does **not** authenticate.
- `POST /logout` ends the session; the protected page is no longer accessible afterwards.
- `GET /dashboard` (protected) returns `200` for an authenticated session and redirects to
  `/login` for guests.
- `POST /api/v1/login` returns a usable Sanctum token for valid credentials; that token
  authenticates a subsequent `auth:sanctum` request. Invalid credentials → `401`/`422`
  with a generic message and **no** token.
- `POST /api/v1/logout` revokes the calling token (a reused token is then rejected).
- Login routes are rate-limited (repeated failures are throttled).
- Auth errors do not disclose whether an email is registered.
- Feature tests cover web login/logout (happy + failure + guest redirect) and API
  login/logout (token issued, token works, bad creds rejected, throttling).
- `composer gates` passes (style, PHPStan max, PHPUnit, coverage ≥90%, audit).
