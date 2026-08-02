---
story: PATCH — partial updates for every entity
created: 2026-08-02
---

## Outcome (2026-08-03)

Delivered in full. Shaping settled the one open question the story left: **a date PATCH
cannot read is a `422`** (stored value untouched), rather than being coerced to null the way
`PUT` does — a deliberate exception to "minimize computer says no", documented in
`docs/api.md` and `docs/system.md`. Implemented as `Patch*Request extends Update*Request`
plus the `MergesPatchIntoStoredRecord` concern; `PUT` unchanged.

## Description

Today the only way to change a record is `PUT`, which is a **full replacement**: every field
you leave out is reset to its default. `PATCH` returns `405`. That makes the common case —
"rename this contact", "push this event back an hour", "tick this task off" — needlessly
dangerous. A client must read the whole record, mutate one field and send it all back, and
any field it doesn't know about (added in a later version) is silently wiped.

The sharpest edge is tasks: a `PUT` that omits `completed_at` **reopens a completed task**.
A client that PATCHes `{"title": "..."}` should never be able to cause that.

Add `PATCH /api/v1/{contacts,events,tasks}/{id}` alongside the existing `PUT`. `PUT` keeps
its current full-replacement semantics unchanged — this is additive.

### Semantics

**Only the keys present in the request body change. Absent keys are left exactly as they
are.**

- **Absent** key → field untouched.
- **Explicit `null`** → field cleared (where the column is nullable). `{"email": null}`
  clears the email; omitting `email` keeps it. This distinction is the whole point of the
  story and needs to hold end to end — Laravel's `sometimes` rule plus `validated()`
  returning only present keys gives it for free, but only if nothing merges defaults in
  first.

**The defaulting traits are the trap.** `NormalizesEventInput` and `NormalizesTaskInput`
run in `prepareForValidation()` and `merge()` a value for *every* field, present or not —
that is exactly what makes `PUT` forgiving, and exactly what would destroy PATCH semantics.
PATCH must not reuse them as-is.

**Proposed approach: merge, then normalize.** Load the existing record, overlay the keys
present in the request, and run the *same* normalization over the merged result. One source
of truth for the defaults, and cross-field rules keep working:

- `PATCH` an event's `start_at` past its stored `end_at` → `end_at` is corrected to
  `start_at + 1h` rather than `422`, same as `PUT`.
- `PATCH {"all_day": true}` snaps the stored start/end to whole-day bounds.
- `PATCH` a task's `due_at` recomputes `due_has_time` from the new value's granularity.
- `PATCH {"title": ""}` on an event still yields `"Untitled event"` — blank is not a way to
  bypass the default.

The alternative (validate the patch in isolation, then `fill()`) is simpler but breaks every
cross-field rule above, so it is rejected unless shaping finds a reason.

**Per-entity notes:**

- **Contacts** — no normalization trait. `display_name` is the only required field: PATCHing
  it to `null` or `""` is the one case that should still `422` (a contact with no name is
  not something we can sensibly default). Everything else clears on explicit `null`.
- **Events** — `title`, `start_at`, `end_at`, `all_day` are all defaulted, so a PATCH can
  never leave them null; `description` and `location` clear normally.
- **Tasks** — `PATCH {"completed_at": null}` reopens; `PATCH {"completed_at": "..."}`
  completes; omitting it changes nothing. `due_has_time` is **derived**, never taken from
  the body — patching it directly should be ignored, as it is on `PUT`.

### What this replaces

Three existing tests assert the opposite of this story and must be inverted, not deleted
quietly: `ContactApiTest::test_patch_is_not_allowed` (`tests/Feature/ContactApiTest.php:273`),
`EventApiTest::test_patch_is_not_allowed` (`:331`) and
`TaskApiTest::test_patch_is_not_allowed` (`:312`). The `405`-on-PATCH line in
`docs/api.md:18` and the "no PATCH" comments in `routes/api.php:40,44` go with them.

`POST /tasks/{id}/complete` stays as it is — it is an action, not a partial update, and now
has an obvious PATCH equivalent (`{"completed_at": "..."}`). Worth a line in the docs saying
so; not worth removing.

## Acceptance Criteria

- `PATCH /api/v1/contacts/{id}`, `/events/{id}`, `/tasks/{id}` exist, require
  `auth:sanctum`, and return `200` with the full updated resource in the same shape as
  `PUT`.
- A PATCH carrying **one** field changes that field and **provably leaves every other field
  at its stored value** — asserted field by field, per entity, not just on the one that
  changed.
- An **explicit `null`** clears a nullable field; the **same field omitted** leaves it
  unchanged. Both directions asserted per entity.
- `PATCH {"title": "..."}` on a **completed** task leaves `completed_at` intact. This is the
  regression the story exists for and must be pinned by its own test.
- `PATCH {"completed_at": null}` reopens a completed task; `PATCH {"completed_at": "…"}`
  completes an open one.
- Cross-field normalization still applies to the **merged** record: patching an event's
  `start_at` past its stored `end_at` corrects `end_at` rather than returning `422`;
  patching `all_day` to `true` snaps the stored bounds; patching a task's `due_at` from a
  datetime to a date-only value flips `due_has_time` to `false`.
- `PATCH {}` (empty body) is a no-op returning `200` and the unchanged record — not a `422`,
  per "minimize computer says no".
- `PATCH` on a contact with `display_name` set to `null` or `""` returns `422`. No other
  field can `422` on any entity.
- `PATCH` cannot change ownership: a `user_id` in the body is ignored, and PATCHing another
  user's record returns `404` (not `403`), consistent with every other verb.
- `PUT` behaviour is **completely unchanged** — every existing `PUT` test passes with no
  assertion edited, including the full-replacement and reopen-on-omit cases.
- The three `test_patch_is_not_allowed` tests are replaced by real PATCH coverage.
- `docs/api.md` documents PATCH per resource: partial semantics, the null-vs-absent rule,
  and the merged-normalization behaviour with examples. `docs/system.md` records the
  decision under REST & API conventions.
- `composer gates` passes: PHP-CS-Fixer, PHPStan max, PHPUnit, coverage ≥ 90%, audit.

## Out of scope

- JSON Merge Patch / JSON Patch (RFC 7386 / 6902) media types — this is plain JSON with
  "absent means unchanged".
- Optimistic concurrency (ETag / `If-Match` / a version column). Last write still wins, and
  PATCH narrows but does not close that window. Worth its own story.
- Bulk or collection-level PATCH.
- Any change to `PUT`, to the resource shapes, or to the `complete` action.
