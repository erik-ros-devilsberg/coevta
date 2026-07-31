// Offline-first store, shared by every PWA in this repo.
//
// Every read comes from the device and every write is applied there first, then
// queued in the outbox and pushed to the server when a connection allows. The
// UI therefore never waits on the network, and never has to care whether there
// is one.
//
// Nothing here is resource-specific: a caller supplies its own storage names,
// its own remote (listAll/create/update/remove) and its own ordering. Contacts
// passes the A–Z alphabet sort, tasks passes open-before-done. That is the whole
// difference between the two apps' data layers.
//
// Conflict resolution is last-write-wins — see sync.js for why the API forces
// that on us, and docs/system.md for the consequences.

import { createOutbox, newTempId } from './outbox.js';
import { createSync } from './sync.js';

export function createOfflineStore({ kv, outboxKv, remote, sort = (records) => records, onUnauthorized }) {
	const outbox = createOutbox({ kv: outboxKv });
	const sync = createSync({ outbox, kv, remote, onUnauthorized });

	/** Everything on the device, in list order. No network. */
	async function cached() {
		return sort(await kv.all());
	}

	/** One record from the device. No network — detail works offline. */
	async function get(id) {
		return kv.get(id);
	}

	/**
	 * Reconcile the cache with the server's view: upsert what came back, drop
	 * what did not.
	 *
	 * Records with unsynced changes are left alone in both directions. Without
	 * that, a refresh would overwrite an offline edit with the server's stale
	 * copy, and would delete a record created offline (which the server has
	 * never heard of) right out from under the user.
	 *
	 * If the call throws, the cache is untouched — a failed refresh must never
	 * wipe the offline copy.
	 */
	async function refresh() {
		const fromServer = await remote.listAll();
		const pending = await outbox.pendingIds();

		const seen = new Set();
		for (const record of fromServer) {
			seen.add(record.id);
			if (!pending.has(record.id)) {
				await kv.set(record.id, record);
			}
		}

		for (const key of await kv.keys()) {
			if (!seen.has(key) && !pending.has(key)) {
				await kv.del(key);
			}
		}

		return cached();
	}

	/**
	 * Create locally under a temporary id and queue the POST. The record is in
	 * the list immediately; sync swaps in the server's version (and its real id)
	 * when it lands.
	 */
	async function create(payload) {
		const id = newTempId();
		const record = { id, ...payload };

		await kv.set(id, record);
		await outbox.enqueue({ type: 'create', recordId: id, payload });

		return record;
	}

	/**
	 * Replace a record. The payload must be a *complete* body: the API's PUT is a
	 * full replacement, so any field left out is wiped server-side when this
	 * eventually syncs.
	 */
	async function update(id, payload) {
		const record = { ...(await kv.get(id)), ...payload, id };

		await kv.set(id, record);
		await outbox.enqueue({ type: 'update', recordId: id, payload });

		return record;
	}

	async function remove(id) {
		await kv.del(id);
		await outbox.enqueue({ type: 'delete', recordId: id });
	}

	/** Records carrying unsynced changes, for marking them in the list. */
	function pendingIds() {
		return outbox.pendingIds();
	}

	function pendingCount() {
		return outbox.count();
	}

	return { cached, get, refresh, create, update, remove, flush: sync.flush, pendingIds, pendingCount };
}
