---
story: SPA Contacts Module
created: 2026-06-24
---

## Description

A minimalist contacts module for the SPA dashboard that lets an authenticated user
browse, create, edit and delete contacts through the existing Contacts API
(`/api/v1/contacts`). Scope is the minimal Google People-compatible field set only:
`display_name` (required) plus name parts, a single email/phone, organization, address,
notes and birthday. No multiple emails/phones, groups/labels, photos or starring.

The module consumes the stable Contacts endpoints documented in `docs/api.md` and
authenticates with the SPA's Sanctum bearer token.

## Acceptance Criteria

- A list view loads contacts from `GET /api/v1/contacts` (paginated, 25/page), shows
  `display_name` and a secondary line (email or organization), and supports paging.
- A client-side filter/search box narrows the visible list by name/email/organization.
- Selecting a contact shows a read-only detail view of all minimal fields; `birthday`
  renders as `YYYY-MM-DD`.
- A create form requires `display_name` and accepts the remaining optional fields;
  submitting issues `POST /api/v1/contacts` and the contact appears in the list.
- An edit form pre-fills from the contact; saving issues `PUT /api/v1/contacts/{id}`
  (full replacement) and updates the list/detail view.
- A contact can be deleted via `DELETE /api/v1/contacts/{id}` with a confirmation step.
- Validation errors from the API (e.g. missing `display_name`, invalid email) are shown
  inline against the relevant field using the `422` error envelope.
- Loading and empty states are shown (e.g. "No contacts yet"); a `401` redirects to login.
- The module is minimalist: only the fields the API carries; no labels, photos, multiple
  emails/phones or favourites.
