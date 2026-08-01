---
story: PWA Password Reset Access
created: 2026-08-01
---

## Description

None of the three PWAs (Contacts, Tasks, Calendar) offer a way to reset a
forgotten password. Each has its own in-scope login view, but a user who cannot
remember their password has no route forward — the only "Forgot your password?"
link lives in the legacy SPA login at `/login`, which an installed PWA user
never sees.

The backend and the reset page already exist and need no changes:

- `POST /api/forgot-password` and `POST /api/reset-password` (`routes/api.php`),
  both rate-limited, no account enumeration.
- `/reset-password` (`resources/spa/views/ResetPasswordView.vue`) is dual-mode:
  without a token it shows the "email me a link" request form, with a token from
  the email it shows the "choose a new password" form.

So this story is about access and wording, not new mechanics.

**Reset is deliberately central, not per-app.** There is one account and one
credential behind all three PWAs, and `PasswordResetController` revokes existing
tokens on success — a reset therefore signs the user out of Contacts, Tasks and
Calendar at once. Giving each PWA its own reset screen would imply per-app
credentials, which is untrue. A single shared reset page communicates the real
scope of the action.

This means the reset link navigates out of the PWA's service worker scope and an
installed app opens a browser tab. That is accepted, and treated as correct
signalling: the user is performing an account-level operation, not a Contacts
one. The seam between app and account belongs here.

Two consequences to handle rather than ignore: the copy must say the reset
affects the whole account, and after a successful reset the user must be able to
get back to the app they started from. Today `ResetPasswordView` redirects to
the SPA login (`router.push('/login')`), which strands a Contacts user in an app
they were not using.

## Acceptance Criteria

- Each PWA login view — `ContactsLoginView`, `TasksLoginView`,
  `CalendarLoginView` — shows a visible link to the central reset page at
  `/reset-password`.
- The link wording states that resetting affects the whole account and signs the
  user out of all apps, rather than implying it is scoped to the current app
  (e.g. "Forgot your password? Reset it for your whole account").
- The link is a plain outbound navigation to `/reset-password`, not an in-scope
  route added to any PWA router — no PWA gains a reset view of its own.
- The reset request form and the token form continue to work unchanged for users
  arriving from the SPA login.
- A successful password reset lands on a dedicated confirmation page rather than
  silently redirecting to `/login`.
- The confirmation page states that the password now applies to the whole
  account and that every app has been signed out, and links to all three apps
  (`/contacts/`, `/tasks/`, `/calendar/`) plus the SPA login, so the user can
  return to whichever app they started from.
- The confirmation page has its own path and is served by the shell in
  `routes/web.php` alongside `/login`, `/dashboard` and `/reset-password`, so
  reloading it or landing on it directly resolves instead of 404ing.
- Links to the three apps are plain outbound navigations, so each opens its own
  PWA at its own service worker scope.
- A user who started at a PWA login, reset their password, and returned to that
  PWA can log in with the new password and reaches the app's list view.
- Existing tokens are revoked on reset, so a PWA left open on another device is
  bounced to its own in-scope login on its next authenticated request.
- Tests cover: the reset link renders in all three PWA login views, the
  post-reset confirmation renders return links, and the account-wide sign-out
  wording is present.
