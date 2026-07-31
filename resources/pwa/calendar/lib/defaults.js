// The client's mirror of the API's event normalization.
//
// The Events API is deliberately forgiving (docs/system.md → Events, "Forgiving
// input"): it fills a blank title, defaults end_at to start_at + 1 hour, and
// snaps all-day events. Online that is invisible — the server hands back the
// resolved record. Offline there is no server, so an event created with no end
// time would have no end time until it synced, and would then visibly change.
//
// So the rules live here too. This IS duplication, and the two copies can drift;
// it is the accepted cost of the grid not rearranging itself under the user. If
// the API's defaults change, this file changes with them.

const HOUR_MS = 60 * 60 * 1000;

/** The date part of either a date-only value or an ISO datetime. */
function dateOf(value) {
	return String(value).slice(0, 10);
}

function parse(value) {
	const ms = value ? Date.parse(value) : Number.NaN;

	return Number.isNaN(ms) ? null : ms;
}

/**
 * Build the request body for create/update.
 *
 * Always returns every field: the API's PUT is a full replacement and the outbox
 * may hold this body for hours before sending it, so it has to be complete at
 * the moment it is built.
 */
export function buildEventBody(
	{ title = '', location = '', all_day = false, start_at = null, end_at = null } = {},
	{ now = () => new Date().toISOString() } = {},
) {
	const allDay = Boolean(all_day);
	const trimmed = (title ?? '').trim();

	if (allDay) {
		// All-day events are sent as date-only values — the same thing the API
		// receives and snaps to 00:00:00–23:59:59. Keeping them date-only locally
		// also keeps them on the right grid cell in every timezone.
		const start = start_at ? dateOf(start_at) : dateOf(now());
		const end = end_at ? dateOf(end_at) : start;

		return {
			title: trimmed === '' ? 'Untitled event' : trimmed,
			location: location === '' ? null : location,
			all_day: true,
			start_at: start,
			// An end before the start is corrected rather than rejected.
			end_at: end < start ? start : end,
		};
	}

	// An unparseable or missing start falls back to now, as the API does.
	const startMs = parse(start_at) ?? Date.parse(now());
	const endMs = parse(end_at);

	return {
		title: trimmed === '' ? 'Untitled event' : trimmed,
		location: location === '' ? null : location,
		all_day: false,
		start_at: new Date(startMs).toISOString(),
		// Missing or before the start → the default hour. Equal is kept: a
		// zero-length event is a thing someone might mean.
		end_at: new Date(endMs === null || endMs < startMs ? startMs + HOUR_MS : endMs).toISOString(),
	};
}
