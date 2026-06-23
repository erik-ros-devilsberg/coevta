---
story: Project Foundation & Quality Tooling
created: 2026-06-23
---

## Description

Stand up the Laravel skeleton and the automated quality-control toolchain that every
subsequent feature relies on. This story produces no business features — it produces a
project that can be tested, linted, statically analysed and shipped through CI. It also
fixes the shared REST conventions the contacts/events/tasks stories will follow.

Entities come later; this is the scaffold and the guardrails.

## REST & API conventions (shared by all entities)

- JSON in, JSON out. `Content-Type: application/json`.
- Resource routes: `index` (GET collection), `show` (GET one), `store` (POST),
  `update` (PUT/PATCH), `destroy` (DELETE).
- Validation in `FormRequest` classes; responses via API `Resource` classes.
- Consistent error envelope (`422` validation, `404` not found, `400` bad request).
- Timestamps serialized as RFC 3339 / ISO 8601 UTC (Google-compatible).

## Decisions to fine-tune before building

| Topic | Proposed default | Alternatives / notes |
|-------|------------------|----------------------|
| Laravel version | Latest LTS-ish stable | Pin in `composer.json` |
| ID strategy | UUID (v7) primary keys | Auto-increment ints — UUIDs ease federation/sync later |
| API prefix / versioning | `/api/v1/...` | No prefix; header versioning |
| Auth | None in v1 (component is embedded/trusted) | Token/Sanctum later |
| Pagination | Laravel default paginator, 25/page | Cursor pagination |
| Soft deletes | Off | On (Google APIs expose deleted/trashed state) |
| Coverage threshold | 90% | Adjust once suite exists |

## Quality tooling to install

- PHPUnit (with coverage) — **required**
- PHPStan / Larastan at a high level (target level 8 or max) — **required**
- PHP-CS-Fixer configured for **tab** indentation (`->setIndent("\t")`), PSR-12 ruleset minus spaces-indent
- Rector (refactoring/upgrade rules) — optional, recommend dry-run first
- Infection (mutation testing) — optional, can defer
- `composer audit` for dependency vulnerabilities
- Composer scripts: `test`, `stan`, `fix`
- `.editorconfig` with `indent_style = tab`

## Acceptance Criteria

- A fresh Laravel app boots and serves a health/ping route returning JSON.
- `composer test`, `composer stan` and `composer fix` all run and pass on the empty skeleton.
- PHPStan runs at the agreed level with zero errors.
- PHP-CS-Fixer enforces tab indentation; `vendor/bin/php-cs-fixer fix --dry-run --diff` is clean.
- The shared REST conventions above are documented in `docs/system.md` (or referenced from CLAUDE.md).
- Tests live under `/tests` per the agile rules.
- The id-strategy, versioning, auth and soft-delete decisions are recorded as resolved before any entity work begins.
