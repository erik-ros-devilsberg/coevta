import { describe, it, expect } from 'vitest';

import { buildEventBody } from './defaults.js';

// The Events API is deliberately forgiving: it fills a missing title, defaults
// end_at and snaps all-day events. Offline there is no server to do any of that,
// so these rules are mirrored here — otherwise an event created offline would
// render one way now and jump somewhere else the moment it synced.
//
// See docs/system.md → Events "Forgiving input" for the rules being mirrored.

const NOW = '2026-07-31T09:00:00.000Z';
const build = (input) => buildEventBody(input, { now: () => NOW });

describe('title', () => {
	it('keeps a given title, trimmed', () => {
		expect(build({ title: '  Standup  ' }).title).toBe('Standup');
	});

	it('falls back to the API\'s own default when blank', () => {
		expect(build({ title: '   ' }).title).toBe('Untitled event');
		expect(build({}).title).toBe('Untitled event');
	});
});

describe('location', () => {
	it('nulls an empty location', () => {
		expect(build({ title: 'X', location: '' }).location).toBe(null);
	});

	it('keeps a real location', () => {
		expect(build({ title: 'X', location: 'Room 2' }).location).toBe('Room 2');
	});
});

describe('start_at', () => {
	it('keeps a parseable start', () => {
		expect(build({ title: 'X', start_at: '2026-08-01T10:00:00.000Z' }).start_at).toBe('2026-08-01T10:00:00.000Z');
	});

	it('falls back to now when missing', () => {
		expect(build({ title: 'X' }).start_at).toBe(NOW);
	});

	it('falls back to now when unparseable rather than rejecting', () => {
		expect(build({ title: 'X', start_at: 'not-a-date' }).start_at).toBe(NOW);
	});
});

describe('end_at', () => {
	it('defaults to one hour after the start when missing', () => {
		const body = build({ title: 'X', start_at: '2026-08-01T10:00:00.000Z' });

		expect(body.end_at).toBe('2026-08-01T11:00:00.000Z');
	});

	it('resets to the default when it falls before the start', () => {
		const body = build({
			title: 'X',
			start_at: '2026-08-01T10:00:00.000Z',
			end_at: '2026-08-01T09:00:00.000Z',
		});

		expect(body.end_at).toBe('2026-08-01T11:00:00.000Z');
	});

	it('keeps an end equal to the start — a zero-length event is intentional', () => {
		const at = '2026-08-01T10:00:00.000Z';

		expect(build({ title: 'X', start_at: at, end_at: at }).end_at).toBe(at);
	});

	it('keeps a valid later end', () => {
		const body = build({
			title: 'X',
			start_at: '2026-08-01T10:00:00.000Z',
			end_at: '2026-08-01T18:30:00.000Z',
		});

		expect(body.end_at).toBe('2026-08-01T18:30:00.000Z');
	});

	it('rolls over midnight correctly', () => {
		const body = build({ title: 'X', start_at: '2026-08-01T23:30:00.000Z' });

		expect(body.end_at).toBe('2026-08-02T00:30:00.000Z');
	});
});

describe('all-day events', () => {
	it('sends date-only values, which is what the API snaps', () => {
		const body = build({ title: 'X', all_day: true, start_at: '2026-08-01', end_at: '2026-08-03' });

		expect(body.all_day).toBe(true);
		expect(body.start_at).toBe('2026-08-01');
		expect(body.end_at).toBe('2026-08-03');
	});

	it('collapses a datetime to its date when the event is all-day', () => {
		const body = build({ title: 'X', all_day: true, start_at: '2026-08-01T14:00:00.000Z' });

		expect(body.start_at).toBe('2026-08-01');
	});

	it('ends on the start day when no end is given', () => {
		const body = build({ title: 'X', all_day: true, start_at: '2026-08-01' });

		expect(body.end_at).toBe('2026-08-01');
	});

	it('resets an end before the start to the start day', () => {
		const body = build({ title: 'X', all_day: true, start_at: '2026-08-05', end_at: '2026-08-01' });

		expect(body.end_at).toBe('2026-08-05');
	});

	it('coerces all_day to a real boolean', () => {
		expect(build({ title: 'X', all_day: 'yes', start_at: '2026-08-01' }).all_day).toBe(true);
		expect(build({ title: 'X', all_day: undefined, start_at: '2026-08-01T10:00:00.000Z' }).all_day).toBe(false);
	});
});

describe('the body as a whole', () => {
	it('always carries every field, so a queued update cannot wipe one', () => {
		// The outbox stores this verbatim and the API replaces the whole record
		// with it — a missing key here is a field deleted server-side.
		expect(Object.keys(build({ title: 'X' })).sort()).toEqual([
			'all_day',
			'end_at',
			'location',
			'start_at',
			'title',
		]);
	});

	it('builds a valid event from nothing at all', () => {
		// The API accepts an empty POST body; offline behaviour should match.
		const body = build({});

		expect(body.title).toBe('Untitled event');
		expect(body.start_at).toBe(NOW);
		expect(body.end_at).toBe('2026-07-31T10:00:00.000Z');
	});
});
