// The contacts app's offline store: the shared offline machinery, wired to the
// contacts remote and the A–Z ordering the list and scrubber depend on.
//
// Everything interesting lives in shared/lib/store.js — see it (and sync.js) for
// how offline writes, the outbox and last-write-wins actually behave.

import { createKv } from '../../../shared/lib/kv.js';
import {
	listAllContacts,
	createContact,
	updateContact,
	removeContact,
} from '../../../shared/lib/contacts.js';
import { createOfflineStore } from '../../../shared/lib/store.js';
import { sortContacts } from './alphabet.js';

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
	return createOfflineStore({ kv, outboxKv, remote, sort: sortContacts, onUnauthorized });
}
