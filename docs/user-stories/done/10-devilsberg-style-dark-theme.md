---
story: Static Devilsberg landing page
created: 2026-06-24
---

## Description

Replace the Blade-rendered landing page with a single **static** landing page styled in the
**Devilsberg** dark (Onyx) brand. The backend is API-only — there is **no server-side
rendering**. The landing page is plain static HTML/CSS served as a static asset; the only
server-rendered surface in the whole project is the JSON API.

This supersedes the earlier "style the Blade pages" framing: the Blade landing
([08-landing-page-and-login]) goes away in favour of a static page. The authenticated app
(login, dashboard, password-reset form) is a separate client-side concern handled by the
Vue SPA in [11-vue-spa-dashboard].

Archivus (`open-source-code/archivus`) is the structural + dark-aesthetic reference; the
actual tokens are Devilsberg's (Onyx-dominant). Follow the sibling-project CSS convention:
function-split files with a single entry that `@import`s them.

## Scope

- A static landing page (e.g. `public/index.html` or a static entry built by Vite) — no
  Blade, no `@yield`, no controller rendering a view.
- Function-split CSS under a central location (archivus / devilsberg-com pattern):
  an entry (`app.css` / `main.css`) that `@import`s `tokens.css` → `base.css` →
  `layout.css` → `components.css` → `utilities.css`.
- A link/CTA into the app (the Vue SPA / login), wired in story 11.
- Remove the landing Blade view + its route once the static page serves `/`.

## Design direction (Devilsberg brand)

### Color (in `tokens.css`, `:root` custom properties)

- `--onyx: #0a0a10` — page background (dominant).
- `--ghost-white: #f7f7ff` — body text.
- `--blue-slate: #586f7c` — labels, borders, meta.
- `--hot-fuchsia: #ff3366` — CTAs, links, emphasis.
- `--sea-green: #058C42` — success / primary button hover.
- Supporting: `--grey-dark #38464E`, `--gray-mid #BECAD1`, `--gray-light #E9EDF0`.

### Typography

- Headings: **Lemon Milk** (`--font-title`), uppercase for hero/buttons, `0.1em` spacing.
- Body: **Open Sans** (`--font-body`), 1rem / line-height 1.6.
- Lemon Milk via `@font-face` with a `sans-serif` fallback (font file deferred — the brand
  asset lives outside the project; stack degrades gracefully). Logo is a Lemon Milk **text
  wordmark** for now, no binary asset.

### Components / motion

- `.btn--primary`: Blue Slate bg → Sea Green hover, Ghost White text, radius 8px.
- Container max-width 1200px, padding `0 2rem`; section padding `6rem 0`.
- Subtle motion only (`0.2s–0.3s ease`).

## Out of scope

- The Vue SPA, login, dashboard, and the password-reset form (story 11).
- Any server-side rendering or Blade templating.
- The watermark/illustration system and a binary logo asset.

## Acceptance Criteria

- `/` serves a static, Devilsberg-dark landing page (Onyx body, Ghost White text) with
  **no** Blade view rendered server-side; the old landing Blade view and its render route
  are removed.
- CSS lives in a central location split by function (`tokens`, `base`, `layout`,
  `components`, `utilities`) with a single entry that `@import`s them; all brand vars live
  in `tokens.css`; no hardcoded hex outside `tokens.css`.
- A Lemon Milk text wordmark renders on the dark background; the font stack falls back to
  `sans-serif` and the page stays legible if Lemon Milk is absent. Open Sans loads for body.
- Primary CTA follows `.btn--primary` (Blue Slate → Sea Green hover) and links into the app.
- Body text meets WCAG AA (Ghost White on Onyx = 18.5:1); interactive elements have a
  visible focus affordance; layout is single-column at `max-width: 768px`.
- `npm run build` produces the static assets; `composer gates` passes.
