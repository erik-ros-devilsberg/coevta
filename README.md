# COEVTA

Open-source backend component for **CO**ntacts, **EV**ents and **TA**sks, served
over a REST API.

## What this is

A standalone, embeddable Laravel backend that exposes three resources —
contacts, events and tasks — through a clean REST interface. Entities start
**minimalist** and are designed to be **Google-compatible**: field names and
shapes map cleanly onto the Google People, Calendar and Tasks APIs, but we only
carry the most important fields.

Anything beyond the minimal set (recurrence, attendees, reminders, subtasks,
multiple emails/phones, etc.) is explicitly out of scope for the first
iterations and can be layered on later.

## Tech stack

- **PHP / Laravel** — application framework
- **REST** — JSON over HTTP, resource-oriented routing
- **PHPUnit** — automated testing (TDD)
- **PHPStan** (via Larastan) — static analysis / code quality

## API

Resource-oriented REST with standard verbs (index / show / store / update /
destroy):

- `/contacts`
- `/events`
- `/tasks`

JSON request validation via FormRequest classes; JSON responses via API
Resources. Field names mirror Google API naming where practical so payloads are
easy to map.

### Forgiving by design

The API prefers a sensible **default** over rejecting a request. Validation
*normalizes and coerces* input rather than refusing it wherever a reasonable
interpretation exists — e.g. an event's `end_at` defaults to `start_at + 1 hour`,
a missing timezone is assumed **UTC**, and an `end_at` before `start_at` is reset
rather than returning `422`. Hard errors are reserved for input we genuinely
cannot interpret. See `docs/system.md` for each entity's defaults.

## Getting started

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve            # http://127.0.0.1:8000
```

## Quality gates

```bash
composer gates              # run ALL quality gates (style, stan, tests, coverage, audit)
composer test               # phpunit
composer stan               # phpstan / larastan
composer fix                # php-cs-fixer fix (tabs)
composer fix:check          # php-cs-fixer verify only (no changes)
composer coverage           # phpunit + 90% coverage gate (needs pcov/xdebug)
```

Run `composer gates` before committing — it is the single source of truth for
"is this done".

## Documentation

- `docs/system.md` — cumulative decisions and entity defaults
- `docs/alternatives.md` — how COEVTA relates to existing projects

## How COEVTA is different

COEVTA fills a gap: the data model of CalDAV/CardDAV servers, exposed as a clean
**Google-shaped JSON API**, as a drop-in Laravel module. The existing field is
mostly either heavyweight PIM platforms (Nextcloud, Monica) or DAV-protocol
servers (Baïkal, SabreDAV, Radicale). See `docs/alternatives.md` for the full
comparison.

## License

Open source. See `LICENSE`.
