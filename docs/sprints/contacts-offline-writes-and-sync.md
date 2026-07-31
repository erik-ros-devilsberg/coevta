---
sprint: Contacts Offline Writes and Sync Queue
stories:
  - 15-contacts-pwa
status: in-progress
created: 2026-07-15
---

## Goal

Make the Contacts PWA genuinely offline-first rather than offline-tolerant: create, edit
and delete work with no network, and sync when the connection returns. Builds on the
storage and read layer from the Contacts PWA Foundation sprint.

The API has no sync, ETag or `updated_at` support and is not changing, so conflict
resolution is necessarily **last-write-wins**. That is an accepted, documented trade-off.

## Acceptance Criteria

### Durable outbox

- [x] Create, edit and delete apply to local data immediately and enqueue an operation in a persisted outbox
- [x] Queued changes survive a full app restart — the outbox lives in storage, not memory
- [x] The outbox flushes automatically when the app starts online and when the connection returns (`online` event)
- [x] Flushing is serialized — a second flush triggered while one is in progress does not double-send operations
- [x] The number of pending (unsynced) changes is visible in the UI, and records with pending changes are marked in the list

### Identity and ordering

- [x] A contact created offline gets a temporary local id and is immediately visible in the list
- [x] When its create syncs, the local record is replaced by the server's version and the temporary id disappears from local state
- [x] Any queued operations still referencing the temporary id are remapped to the real server id before they are sent
- [x] Operations are sent in the order they were made

### Coalescing

- [x] Create-then-delete while offline cancels both operations — nothing is sent for a record that never existed on the server
- [x] Repeated edits to the same record while offline coalesce to the last value rather than replaying every intermediate save
- [x] An edit to a record whose create is still queued folds into the pending create rather than sending an update for an id the server does not have

### Failure handling

- [x] A queued update or delete for a record the server no longer has (`404`) drops the operation and reconciles local state, without blocking the rest of the queue
- [x] A queued operation the server rejects as invalid (`422`) is dropped from the queue and surfaced to the user, rather than retrying forever and blocking the queue
- [x] A network failure mid-flush leaves the operation queued and retries on the next flush
- [x] A `401` mid-flush stops the flush and returns the user to `/contacts/login`, leaving the queue intact for after re-auth
- [x] One failing operation never permanently blocks operations behind it in the queue

### Quality

- [x] Unit tests (Vitest) cover the outbox and sync engine: enqueue, persistence across restart, ordering, temp-id remap, all three coalescing rules, and each failure path (`404`, `422`, network, `401`)
- [x] Component tests cover offline create/edit/delete and the pending-count indicator
- [x] Last-write-wins conflict resolution and its rationale are documented in `docs/system.md`
- [x] `composer gates` passes and `npm test` passes
- [x] No backend changes — `app/`, `database/` and `routes/api.php` are untouched

## Tasks

- [x] Write tests for the outbox: enqueue, persist/restore, ordering, serialized flush
- [x] Implement `pwa/contacts/lib/outbox.js` over the shared kv store
- [x] Write tests for the coalescing rules (create+delete, update+update, create+update)
- [x] Implement coalescing in the outbox enqueue path
- [x] Write tests for the sync engine including temp-id remap and every failure path
- [x] Implement `pwa/contacts/lib/sync.js` — flush, remap, per-op error classification
- [x] Wire the views onto the write path: optimistic local write + enqueue; pending markers; pending count; flush on `online` and on start
- [x] Write component tests for offline create/edit/delete
- [x] Document the offline architecture and last-write-wins trade-off in `docs/system.md`
- [x] Run `composer gates` and `npm test`; fix until green

## Execution notes

Delivered. `composer gates` passes (156 PHP tests, 100% line coverage) and `npm test`
passes (217 JS tests across 20 files). Both apps build.

**A real bug was found and fixed while writing the sync tests.** Editing a contact while
its create POST was *in flight* silently lost the edit: `enqueue` folded the edit into the
still-queued create op, but that request had already left with the old payload, and the
flush then removed the op. Operations are now flagged `sending` before the request leaves,
and coalescing skips those — so the edit queues separately and `remapContactId` repoints it
at the real id once the create returns. This is what makes the remap path meaningful rather
than near-dead code. Covered by "does not lose an edit made while the create is in flight"
and "repoints a delete made while the create is in flight at the real id".

Other notes:

- **`refresh()` had to change.** Reconciling with the server would have deleted contacts
  created offline and overwritten unsynced edits with the server's stale copy. It now skips
  contacts with pending operations in both directions.
- **The store's write contract changed**, as the previous sprint anticipated: `create`
  returns a record with a temporary id and no longer throws `422`. `ContactFormView` lost
  its inline `422` handling — a rejected write now surfaces on the list after sync, since
  by then the user has moved on from the form.
- **Create returns to the list, not the new contact's detail page.** Routing to a temp id
  would break the moment sync swapped in the server's id.
- **Still not driven in a real browser.** The sync engine is covered by unit tests against
  the memory adapter; a genuine offline→online round trip in a browser (with real
  IndexedDB and a real service worker) has not been performed.

## Risks and Open Questions

- **Last-write-wins loses data by design.** Two devices editing the same contact offline means the later sync silently overwrites the earlier. The API exposes no version or `updated_at` on contacts to detect this, and the backend is fixed, so it cannot be resolved client-side. Documented, not solved.
- **The API's PUT is a full replacement.** A coalesced update must carry every field, or omitted fields are wiped server-side. The existing view already builds full payloads; the outbox must preserve that.
- **`422` on a queued write is unrecoverable offline.** The user has moved on by the time it surfaces. We drop and report rather than block the queue — the alternative (a dead-letter UI for re-editing) is deliberately out of scope.
- **Temp-id remap is the sharpest edge.** A create that fails after the server committed it (network drop on the response) would resend on retry and duplicate the contact. The API has no idempotency key and is not changing, so this window is accepted and noted.
