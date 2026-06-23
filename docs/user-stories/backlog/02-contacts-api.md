---
story: Contacts REST API
created: 2026-06-23
---

## Description

Expose a minimalist **Contacts** resource over REST, with field shapes that map cleanly
onto the Google People API. Only the most important fields are carried; richer People API
features are out of scope for now.

Full CRUD: list, show, create, update, delete.

## Proposed fields (fine-tune before building)

| Field | Type | Required | Google People API mapping | Notes |
|-------|------|----------|---------------------------|-------|
| `id` | uuid | auto | `resourceName` | per foundation id strategy |
| `display_name` | string | yes | `names.displayName` | the headline name |
| `given_name` | string | no | `names.givenName` | first name |
| `family_name` | string | no | `names.familyName` | last name |
| `email` | string (email) | no | `emailAddresses[].value` | **single** primary email in v1 |
| `phone` | string | no | `phoneNumbers[].value` | **single** primary phone in v1 |
| `organization` | string | no | `organizations[].name` | company/org name |
| `created_at` / `updated_at` | datetime | auto | — | ISO 8601 UTC |

### Open questions to fine-tune

- Single `email`/`phone` vs. arrays of `{value, type}` (Google supports multiple). Default: single string for v1.
- Is `display_name` required, or derived from given+family when omitted?
- Include a free-text `notes`/`biography` field (`biographies[].value`)?
- Include `address` now or defer?

## Out of scope

- Multiple emails/phones/addresses, types/labels, photos, birthdays, relations, groups, etag/sync tokens.

## Acceptance Criteria

- `GET /contacts` returns a paginated collection.
- `GET /contacts/{id}` returns a single contact, `404` when missing.
- `POST /contacts` creates a contact; `display_name` validated as required (pending the open question).
- `PUT/PATCH /contacts/{id}` updates an existing contact.
- `DELETE /contacts/{id}` removes a contact.
- Invalid payloads return `422` with field-level errors; email field validated as an email when present.
- Responses are serialized via an API Resource with the agreed field set; timestamps ISO 8601 UTC.
- Feature tests cover each endpoint (happy path + validation + not-found); PHPStan and PHP-CS-Fixer pass.
