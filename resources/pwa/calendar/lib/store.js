// The calendar app's offline store: the shared offline machinery, wired to the
// events remote, plus the two things that are genuinely calendar-shaped —
// the API's defaults applied client-side, and which grid cell a record sits on.
//
// Everything else lives in shared/lib/store.js — see it (and sync.js) for how
// offline writes, the outbox and last-write-wins actually behave.

import { createKv } from '../../../shared/lib/kv.js';
import {
	listAllEvents,
	createEvent,
	updateEvent,
	removeEvent,
} from '../../../shared/lib/events.js';
import { createOfflineStore } from '../../../shared/lib/store.js';
import { buildEventBody } from './defaults.js';
import { dayKeyFor } from './month.js';

export const DB_NAME = 'coevta-calendar';
export const STORE_NAME = 'events';
export const OUTBOX_STORE = 'outbox';

const defaultRemote = {
	listAll: listAllEvents,
	create: createEvent,
	update: updateEvent,
	remove: removeEvent,
};

/**
 * Chronological, with all-day events first within a day.
 *
 * An all-day event is context for the whole day rather than something happening
 * at a moment in it, so it reads first. Comparing on the date part puts it ahead
 * of every timed event that day without special-casing the comparator.
 */
function sortEvents(events) {
	const key = (event) => [String(event.start_at ?? '').slice(0, 10), event.all_day ? 0 : 1, event.start_at ?? ''];

	return [...events].sort((a, b) => {
		const [aDay, aAllDay, aStart] = key(a);
		const [bDay, bAllDay, bStart] = key(b);

		return aDay.localeCompare(bDay) || aAllDay - bAllDay || String(aStart).localeCompare(String(bStart));
	});
}

export function createCalendarStore({
	kv = createKv({ name: DB_NAME, store: STORE_NAME }),
	outboxKv = createKv({ name: DB_NAME, store: OUTBOX_STORE }),
	remote = defaultRemote,
	onUnauthorized,
} = {}) {
	const store = createOfflineStore({ kv, outboxKv, remote, sort: sortEvents, onUnauthorized });

	// Writes go through buildEventBody so the record held locally is the same
	// shape the server would have returned — a complete body, with the API's
	// defaults already applied. Without that an event created offline would be
	// missing fields until it synced and would then visibly change.
	function create(input) {
		return store.create(buildEventBody(input));
	}

	function update(id, input) {
		return store.update(id, buildEventBody(input));
	}

	return { ...store, create, update, dayKey: dayKeyFor };
}
