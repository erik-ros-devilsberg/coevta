---
story: Password reset
created: 2026-06-24
---

## Description

Let a user who has forgotten their password recover access without an admin minting a new
one. Today the only auth surfaces are login (web session + API token) and logout — there
is no recovery path. The stock `password_reset_tokens` table already exists (default
Laravel users migration) but nothing reads or writes it.

This story wires up the standard "request a link → click → set a new password" flow over
both surfaces: a browser (session) flow with Blade screens, and a JSON API flow for
programmatic clients. It was explicitly carved out of scope in [06-user-management], so
this story owns it.

## Proposed surface (fine-tune at shape time)

### Web (session / Blade)

- `GET /forgot-password` — form to enter an email. Named `password.request`.
- `POST /forgot-password` — send the reset link email. Rate-limited. Named `password.email`.
- `GET /reset-password/{token}` — form to set a new password (token + email prefilled).
  Named `password.reset`.
- `POST /reset-password` — apply the new password. Named `password.update`.

### API (JSON)

- `POST /api/v1/forgot-password` — `{ email }` → sends reset link. Rate-limited.
- `POST /api/v1/reset-password` — `{ email, token, password, password_confirmation }`
  → resets the password.

Use Laravel's built-in `Password` broker and `ResetPassword` notification rather than
hand-rolling token storage — it already targets the existing `password_reset_tokens` table.

## Design notes

- **Minimize "computer says no"** still applies, but recovery is security-sensitive, so a
  real password minimum is warranted (min 8 chars, matching [06-user-management]).
- **No account enumeration**: requesting a link for an unknown email returns the same
  success-shaped response as a known email. Never leak whether an address exists.
- **Token expiry**: use the framework default (`config/auth.php` → `passwords.users.expire`,
  60 min) and single-use tokens (the broker deletes on success).
- **Token invalidation on reset**: on a successful web reset, regenerate the session; on
  reset, revoke the user's existing Sanctum tokens so a leaked password can't keep live
  API sessions (fine-tune at shape — default: revoke all of the user's tokens).
- **Mail in local/dev**: rely on the `log`/`array` mailer so tests and local runs don't
  send real mail; assert the notification was sent rather than inspecting an inbox.

## Open questions to fine-tune

- **One flow or two?** Web + API both, or API-only for now? Default: both, sharing the
  same `Password` broker logic.
- **Rate limiting**: reuse the existing `throttle:6,1` pattern from the login routes?
  Default: yes, applied to the request-link endpoints.
- **Reset link URL**: the API flow needs a frontend URL to embed in the email. It points
  at the **Vue SPA** reset route (see story 11), carrying `token` and `email` so the
  client-side form can POST them back to `POST /api/v1/reset-password`. Make the base URL
  configurable (derived from `APP_URL` / a frontend-URL config) so it works before the SPA
  ships.

## Out of scope

- Email verification on signup, MFA, "magic link" passwordless login, account lockout
  after N failures, password history/rotation policies, OAuth / social recovery.

## Acceptance Criteria

- `POST /forgot-password` (and `POST /api/v1/forgot-password`) sends a `ResetPassword`
  notification for a known email and returns a success response.
- An unknown email returns the same success-shaped response — no enumeration; tests assert
  no notification is sent but the response is indistinguishable.
- `POST /reset-password` (and the API equivalent) sets a new hashed password when the
  token is valid and unexpired; the user can then log in with the new password.
- An invalid, expired, or already-used token is rejected (`422` / redirect with errors)
  and the password is unchanged.
- A successful reset revokes the user's existing Sanctum tokens (old tokens 401 afterward).
- Reset request endpoints are rate-limited (`throttle:6,1`); passwords are never returned.
- Feature tests cover: link request (known + unknown email), successful reset, expired
  token, reused token, wrong email/token pairing, rate limiting, and token revocation.
- `composer gates` passes (style, PHPStan max, PHPUnit, coverage ≥90%, audit).
