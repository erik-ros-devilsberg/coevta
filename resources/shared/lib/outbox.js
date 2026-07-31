// Durable queue of writes waiting to reach the server.
//
// Edits made offline are applied locally and parked here until a connection
// returns. It lives in storage rather than memory, so closing the app with
// unsynced edits does not lose them.
//
// Ordering is explicit: each operation gets a monotonic sequence number, and the
// next one is derived from what is already stored — so a restart continues the
// sequence rather than replaying from zero.
//
// Nothing here knows what a record is. Operations carry a `recordId` and an
// opaque `payload`, so contacts, tasks and calendar all share one queue
// implementation rather than each growing their own copy.

const TEMP_PREFIX = 'local-';

/** Ids for records created offline, before the server has assigned a real one. */
export function newTempId() {
	const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

	return `${TEMP_PREFIX}${random}`;
}

export function isTempId(id) {
	return String(id ?? '').startsWith(TEMP_PREFIX);
}

// Keys sort lexicographically in the store, so pad the sequence to keep numeric
// order and string order the same.
const key = (seq) => `op-${String(seq).padStart(12, '0')}`;

export function createOutbox({ kv }) {
	async function list() {
		return (await kv.all()).sort((a, b) => a.seq - b.seq);
	}

	async function nextSeq() {
		const ops = await list();

		return ops.length === 0 ? 1 : ops[ops.length - 1].seq + 1;
	}

	async function remove(id) {
		await kv.del(id);
	}

	/**
	 * Add an operation, collapsing it against what is already queued.
	 *
	 * Coalescing is not just an optimisation here. Sending an update for a
	 * record whose create has not synced would target an id the server has
	 * never seen; sending a create followed by a delete would leave a ghost
	 * record if the delete failed. Folding them is what keeps the queue
	 * meaningful.
	 */
	async function enqueue(op) {
		const queued = await list();
		// An operation already in flight must never be folded into: its request
		// has left, so amending it here would silently drop the new edit. Those
		// edits queue separately and are repointed by remapRecordId once the
		// create comes back with a real id.
		const pendingFor = queued.filter((existing) => existing.recordId === op.recordId && !existing.sending);
		const create = pendingFor.find((existing) => existing.type === 'create');
		const update = pendingFor.find((existing) => existing.type === 'update');

		if (op.type === 'update' && create) {
			// The record does not exist server-side yet — fold the edit into the
			// create so one POST carries the final value.
			await kv.set(create.id, { ...create, payload: { ...op.payload } });
			return;
		}

		if (op.type === 'update' && update) {
			// Last write wins locally too; no point replaying every save.
			await kv.set(update.id, { ...update, payload: { ...op.payload } });
			return;
		}

		if (op.type === 'delete' && create) {
			// Created and deleted while offline: the server never knew about it,
			// so both sides cancel and nothing is sent.
			await remove(create.id);
			for (const stale of pendingFor.filter((existing) => existing.type === 'update')) {
				await remove(stale.id);
			}
			return;
		}

		if (op.type === 'delete' && update) {
			// No point sending an edit for something about to be removed.
			await remove(update.id);
		}

		const seq = await nextSeq();
		await kv.set(key(seq), { ...op, id: key(seq), seq });
	}

	/**
	 * Flag an operation as in flight. Coalescing skips these — see enqueue.
	 * Cleared again if the send fails and the operation stays queued.
	 */
	async function markSending(id, sending = true) {
		const op = await kv.get(id);
		if (op) {
			await kv.set(id, { ...op, sending });
		}
	}

	/**
	 * Repoint queued operations at the real id once a create has synced. Without
	 * this, an edit made while the create was still in flight would be sent for
	 * a temporary id and 404.
	 */
	async function remapRecordId(from, to) {
		for (const op of await list()) {
			if (op.recordId === from) {
				await kv.set(op.id, { ...op, recordId: to });
			}
		}
	}

	async function count() {
		return (await kv.keys()).length;
	}

	/** Records carrying unsynced changes, for marking them in the list. */
	async function pendingIds() {
		return new Set((await list()).map((op) => op.recordId));
	}

	return { enqueue, list, remove, markSending, remapRecordId, count, pendingIds };
}
