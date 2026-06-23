# Alternatives & competitive positioning

How coevta relates to existing open-source projects that handle contacts,
events and/or tasks.

## Key distinction

coevta is a **plain REST/JSON API** with **Google-API-shaped fields** (People,
Calendar, Tasks) exposed as a **minimalist, embeddable Laravel backend**.

Most of the established field speaks **CalDAV/CardDAV** (iCal/vCard sync
protocols), not clean JSON REST — a different niche.

## Closest in spirit (REST/JSON APIs)

- **Nettu Scheduler** — self-hosted calendar/scheduler server, simple REST API +
  JS/Rust SDKs. Closest to the "JSON REST, not DAV" approach, but calendar-only
  (no contacts/tasks) and Rust, not Laravel.
  https://github.com/fmeringdal/nettu-scheduler
- **Cal.com** — open-source scheduling (Calendly alternative) with a REST API.
  Much heavier / booking-focused, but JSON-first.

## Broad PIM platforms (cover all three resources, but as full apps)

- **Nextcloud** — Contacts + Calendar + Tasks apps. Has REST/OCS APIs but is a
  whole platform; CalDAV/CardDAV under the hood.
- **Monica** — open-source personal CRM (Laravel, same stack) — contacts + tasks
  + reminders + events. A full app with UI, not a minimalist embeddable backend.
- **EteSync / Etebase** — end-to-end encrypted PIM server for contacts / calendar
  / tasks, with a REST-ish API.

## CalDAV/CardDAV servers (protocol servers, not JSON REST)

Do contacts/events/tasks via iCal/vCard sync protocols — not what coevta builds,
but the usual "existing functionality" people reach for:

- **Baïkal** — lightweight PHP CalDAV+CardDAV server (built on SabreDAV)
- **SabreDAV** — PHP CardDAV/CalDAV/WebDAV framework; most PHP DAV servers build
  on it
- **Radicale** — small Python CalDAV/CardDAV server
- **Xandikos** — Git-backed CardDAV/CalDAV server

## How coevta is differentiated

No existing project matches the exact combination:

> minimalist Laravel backend + REST/JSON + Google People/Calendar/Tasks-compatible
> field shapes + all three resources in one embeddable component.

Closest analogues:

- **Monica** — same stack, but a full CRM app
- **Nettu** — same JSON-REST philosophy, but calendar-only, Rust
- **SabreDAV / Baïkal** — PHP + all three resources, but protocol-oriented, not JSON

The niche: *the DAV servers' data model, exposed as a clean Google-shaped JSON API,
as a drop-in Laravel module.* That gap is real — the field is either heavyweight
platforms or DAV-protocol servers.

## Sources

- awesome-selfhosted — Calendar & Contacts:
  https://awesome-selfhosted.net/tags/calendar--contacts.html
- Nettu Scheduler: https://github.com/fmeringdal/nettu-scheduler
- 16 Open-source Calendar Solutions: https://medevel.com/os-calendar-scheduler/
- Best 11 Open-source CalDAV Servers: https://medevel.com/11-caldav-os-servers/
