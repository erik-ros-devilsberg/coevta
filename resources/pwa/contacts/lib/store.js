// Offline-first contacts store.
//
// Every read comes from the device and every write is applied there first, then
// queued in the outbox and pushed to the server when a connection allows. The
// UI therefore never waits on the network, and never has to care whether there
// is one.
//
// Conflict resolution is last-write-wins — see sync.js for why that is forced
// on us by the API, and docs/system.md for the consequences.

import { createKv } from '../../../shared/lib/kv.js';
import {
	listAllContacts,
	createContact,
	updateContact,
	removeContact,
} from '../../../shared/lib/contacts.js';
import { sortContacts } from './alphabet.js';
import { createOutbox, newTempId } from './outbox.js';
import { createSync } from './sync.js';

export const DB_NAME = 'coevta-contacts';
export const STORE_NAME = 'contacts';
export const OUTBOX_STORE = 'outbox';

const defaultRemote = {
	listAll: listAllContacts,
	create: createContact,
	update: updateContact,
	remove: removeContact,
};

export function createContactsStore({
	kv = createKv({ name: DB_NAME, store: STORE_NAME }),
	outboxKv = createKv({ name: DB_NAME, store: OUTBOX_STORE }),
	remote = defaultRemote,
	onUnauthorized,
} = {}) {
	const outbox = createOutbox({ kv: outboxKv });
	const sync = createSync({ outbox, kv, remote, onUnauthorized });

	/** Everything on the device, in list order. No network. */
	async function cached() {
		return sortContacts(await kv.all());
	}

	/** One contact from the device. No network — detail works offline. */
	async function get(id) {
		return kv.get(id);
	}

	/**
	 * Reconcile the cache with the server's view: upsert what came back, drop
	 * what did not.
	 *
	 * Contacts with unsynced changes are left alone in both directions. Without
	 * that, a refresh would overwrite an offline edit with the server's stale
	 * copy, and would delete a contact created offline (which the server has
	 * never heard of) right out from under the user.
	 *
	 * If the call throws, the cache is untouched — a failed refresh must never
	 * wipe the offline copy.
	 */
	async function refresh() {
		const fromServer = await remote.listAll();
		const pending = await outbox.pendingIds();

		const seen = new Set();
		for (const contact of fromServer) {
			seen.add(contact.id);
			if (!pending.has(contact.id)) {
				await kv.set(contact.id, contact);
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
	 * Create locally under a temporary id and queue the POST. The contact is in
	 * the list immediately; sync swaps in the server's record (and its real id)
	 * when it lands.
	 */
	async function create(payload) {
		const id = newTempId();
		const record = { id, ...payload };

		await kv.set(id, record);
		await outbox.enqueue({ type: 'create', contactId: id, payload });

		return record;
	}

	async function update(id, payload) {
		const record = { ...(await kv.get(id)), ...payload, id };

		await kv.set(id, record);
		await outbox.enqueue({ type: 'update', contactId: id, payload });

		return record;
	}

	async function remove(id) {
		await kv.del(id);
		await outbox.enqueue({ type: 'delete', contactId: id });
	}

	/** Contacts carrying unsynced changes, for marking them in the list. */
	function pendingIds() {
		return outbox.pendingIds();
	}

	function pendingCount() {
		return outbox.count();
	}

	return { cached, get, refresh, create, update, remove, flush: sync.flush, pendingIds, pendingCount };
}
