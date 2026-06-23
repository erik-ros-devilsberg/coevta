# coevta

Open-source backend component for **CO**ntacts, **EV**ents and **TA**sks, served over a REST API.

## What this is

A standalone, embeddable Laravel backend that exposes three resources — contacts, events and tasks — through a clean REST interface. Entities start **minimalist** and are designed to be **Google-compatible**: field names and shapes map cleanly onto the Google People, Calendar and Tasks APIs, but we only carry the most important fields. Anything beyond the minimal set (recurrence, attendees, reminders, subtasks, multiple emails/phones, etc.) is explicitly out of scope for the first iterations and can be layered on later.

## Tech stack

- **PHP / Laravel** — application framework
- **REST** — JSON over HTTP, resource-oriented routing
- **PHPUnit** — automated testing (TDD; tests live in `/tests`)
- **PHPStan** (via Larastan) — static analysis / code quality

## Recommended additional quality controls

Suggested on top of PHPUnit + PHPStan. Adopt incrementally via the foundation story:

- **PHP-CS-Fixer** — code formatter configured for **tab** indentation (`->setIndent("\t")`); PSR-12 ruleset minus the spaces-indent rule
- **Rector** — automated refactoring and PHP/Laravel upgrade rules
- **Infection** — mutation testing to measure test *effectiveness*, not just coverage
- **PHPUnit coverage threshold** — fail below an agreed minimum (e.g. 90%)
- **composer audit** — flag known vulnerabilities in dependencies
- **Pre-commit hooks** (GrumPHP or CaptainHook) — run PHP-CS-Fixer + PHPStan locally before commit
- **OpenAPI / Scribe** — generate API documentation from routes and tests
- **EditorConfig** — consistent whitespace across editors (set `indent_style = tab`)

## Architecture conventions

- Resource-oriented REST: `/contacts`, `/events`, `/tasks` with standard verbs (index/show/store/update/destroy)
- JSON request validation via FormRequest classes; JSON responses via API Resources
- Eloquent models, one migration per entity, id strategy decided in the foundation story
- Keep controllers thin — validation in FormRequests, serialization in Resources
- Field names mirror Google API naming where practical so payloads are easy to map

## Common commands

```bash
composer test                      # phpunit
composer stan                      # phpstan / larastan
composer fix                       # php-cs-fixer fix (tabs)
vendor/bin/php-cs-fixer fix --dry-run --diff   # code style check
```

## Agile Workflow

This project uses the agile plugin. Follow these rules when building features.

### Flow

```
1. Human writes user stories to docs/user-stories/backlog/
2. /agile:shape <story-slug> [<story-slug2> ...]
        → product-manager reads stories and shapes a sprint plan → saved to docs/sprints/
        STOP: human reviews and approves plan
3. /agile:execute docs/sprints/<sprint-slug>.md
        → developer implements (TDD: tests first, then implement)
        STOP: human reviews the work
4. /agile:review (optional, ad-hoc)
        → reviewer reports findings inline
        → human fixes defects now or creates new user stories
5. /agile:wrap-sprint
        → documents sprint in docs/system.md
        → moves user stories to docs/user-stories/done/
        → deletes sprint plan
6. /agile:commit → commit and push
```

### Rules

- Never start building without an approved sprint plan in `docs/sprints/`
- Sprint plans are the single source of truth for the sprint — update them as execution progresses
- Developer writes tests first, then implements — never skip writing tests
- Tests live in a seperate directory structure in the project root /tests
- Review is user invoked — trigger it with `/agile:review`
- Defects found in review become new user stories
- Do not make changes outside project directory

### Directory structure

- `docs/user-stories/backlog/` — pending user stories (human-written)
- `docs/user-stories/done/` — completed user stories (moved here by `/agile:wrap-sprint`)
- `docs/sprints/` — active sprint plans (deleted after `/agile:wrap-sprint`)
- `docs/system.md` — cumulative decisions and outcomes

### User story format

File naming: `NN-story-name.md` — use a two-digit number prefix to control ordering (e.g. `01-user-authentication.md`, `02-password-reset.md`).

```markdown
---
story: <Story Name>
created: YYYY-MM-DD
---

## Description

<What needs to be built and why>

## Acceptance Criteria

- <criterion 1 — specific and testable>
- <criterion 2>
```

### Human gates

1. After `/agile:shape` — approve the sprint plan before executing
2. After `/agile:execute` — review the work and decide whether to run `/agile:review`
