import { describe, it, expect, beforeEach, vi } from 'vitest';

import { memoryKv } from '../../../shared/lib/kv.js';
import { isTempId } from '../../../shared/lib/outbox.js';
import { createCalendarStore } from './store.js';

const event = (id, title, extra = {}) => ({
	id,
	title,
	location: null,
	all_day: false,
	start_at: '2026-08-01T10:00:00.000Z',
	end_at: '2026-08-01T11:00:00.000Z',
	...extra,
});

let kv;
let outboxKv;
let remote;
let store;
let server;

beforeEach(() => {
	kv = memoryKv();
	outboxKv = memoryKv();
	server = [];
	remote = {
		listAll: vi.fn(async () => server),
		create: vi.fn(async (body) => ({ data: { id: 'srv-new', ...body } })),
		update: vi.fn(async (id, body) => ({ data: { id, ...body } })),
		remove: vi.fn(async () => null),
	};
	store = createCalendarStore({ kv, outboxKv, remote });
});

describe('reading', () => {
	it('lists what is on the device with no network', async () => {
		await kv.set('a', event('a', 'Standup'));

		expect((await store.cached()).map((e) => e.title)).toEqual(['Standup']);
		expect(remote.listAll).not.toHaveBeenCalled();
	});

	it('orders events within the set by start time', async () => {
		await kv.set('late', event('late', 'Late', { start_at: '2026-08-01T15:00:00.000Z' }));
		await kv.set('early', event('early', 'Early', { start_at: '2026-08-01T08:00:00.000Z' }));

		expect((await store.cached()).map((e) => e.id)).toEqual(['early', 'late']);
	});

	it('sorts all-day events before timed ones on the same day', async () => {
		// An all-day event is context for the whole day, so it reads first.
		await kv.set('timed', event('timed', 'Timed', { start_at: '2026-08-01T08:00:00.000Z' }));
		await kv.set('allday', event('allday', 'All day', { all_day: true, start_at: '2026-08-01', end_at: '2026-08-01' }));

		expect((await store.cached()).map((e) => e.id)).toEqual(['allday', 'timed']);
	});
});

describe('creating offline', () => {
	it('gives a new event a temporary id and shows it immediately', async () => {
		const created = await store.create({ title: 'Standup', start_at: '2026-08-01T10:00:00.000Z' });

		expect(isTempId(created.id)).toBe(true);
		expect((await store.cached()).map((e) => e.title)).toEqual(['Standup']);
		expect(remote.create).not.toHaveBeenCalled();
	});

	it('fills the API\'s defaults locally, so the event is complete before it syncs', async () => {
		// No end time given. Without the client-side default the local record
		// would have end_at: null until sync, then suddenly gain one.
		const created = await store.create({ title: 'Standup', start_at: '2026-08-01T10:00:00.000Z' });

		expect(created.end_at).toBe('2026-08-01T11:00:00.000Z');
		expect(created.title).toBe('Standup');
	});

	it('replaces the temp record with the server\'s when the create syncs', async () => {
		const created = await store.create({ title: 'Standup', start_at: '2026-08-01T10:00:00.000Z' });

		await store.flush();

		expect(await kv.get(created.id)).toBe(null);
		expect(await kv.get('srv-new')).toMatchObject({ title: 'Standup' });
	});

	it('sends a complete body, so the full-replacement PUT cannot wipe a field', async () => {
		await store.create({ title: 'Standup', location: 'Room 2', start_at: '2026-08-01T10:00:00.000Z' });

		await store.flush();

		expect(remote.create).toHaveBeenCalledWith({
			title: 'Standup',
			location: 'Room 2',
			all_day: false,
			start_at: '2026-08-01T10:00:00.000Z',
			end_at: '2026-08-01T11:00:00.000Z',
		});
	});
});

describe('an event created offline does not move when it syncs', () => {
	it('keeps a timed event on the same day', async () => {
		const created = await store.create({ title: 'Standup', start_at: '2026-08-01T10:00:00.000Z' });
		const before = store.dayKey(await store.get(created.id));

		// The server echoes the record back with its own id.
		await store.flush();
		const after = store.dayKey(await kv.get('srv-new'));

		expect(after).toBe(before);
	});

	it('keeps an all-day event on the same day even though the server returns midnight UTC', async () => {
		// The sharpest placement bug available: we hold '2026-08-01', the server
		// returns '2026-08-01T00:00:00Z', and resolving that in local time would
		// drop the event onto 31 July for anyone west of UTC.
		const created = await store.create({ title: 'Holiday', all_day: true, start_at: '2026-08-01' });
		const before = store.dayKey(await store.get(created.id));

		remote.create.mockResolvedValueOnce({
			data: {
				id: 'srv-new',
				title: 'Holiday',
				location: null,
				all_day: true,
				start_at: '2026-08-01T00:00:00.000Z',
				end_at: '2026-08-01T23:59:59.000Z',
			},
		});
		await store.flush();

		expect(before).toBe('2026-08-01');
		expect(store.dayKey(await kv.get('srv-new'))).toBe('2026-08-01');
	});
});

describe('editing and deleting offline', () => {
	it('applies an edit locally at once and queues one update', async () => {
		await kv.set('a', event('a', 'Standup'));

		await store.update('a', { title: 'Standup (moved)', start_at: '2026-08-02T10:00:00.000Z' });

		expect((await store.get('a')).title).toBe('Standup (moved)');
		expect(remote.update).not.toHaveBeenCalled();

		await store.flush();
		expect(remote.update).toHaveBeenCalledWith('a', expect.objectContaining({ title: 'Standup (moved)' }));
	});

	it('removes an event locally at once and on the server when it syncs', async () => {
		await kv.set('a', event('a', 'Standup'));

		await store.remove('a');
		expect(await store.cached()).toEqual([]);

		await store.flush();
		expect(remote.remove).toHaveBeenCalledWith('a');
	});
});

describe('refreshing', () => {
	it('does not overwrite an event with unsynced changes', async () => {
		await kv.set('a', event('a', 'Standup'));
		await store.update('a', { title: 'Renamed offline', start_at: '2026-08-01T10:00:00.000Z' });

		server = [event('a', 'Standup')];
		await store.refresh();

		expect((await store.get('a')).title).toBe('Renamed offline');
	});

	it('does not delete an event created offline that the server has never seen', async () => {
		const created = await store.create({ title: 'New', start_at: '2026-08-01T10:00:00.000Z' });

		server = [];
		await store.refresh();

		expect(await store.get(created.id)).not.toBe(null);
	});
});

describe('pending changes', () => {
	it('reports how many changes are waiting and which events they touch', async () => {
		await kv.set('a', event('a', 'Standup'));
		await store.update('a', { title: 'Edited', start_at: '2026-08-01T10:00:00.000Z' });

		expect(await store.pendingCount()).toBe(1);
		expect([...(await store.pendingIds())]).toEqual(['a']);
	});

	it('is clear once everything syncs', async () => {
		await kv.set('a', event('a', 'Standup'));
		await store.update('a', { title: 'Edited', start_at: '2026-08-01T10:00:00.000Z' });

		await store.flush();

		expect(await store.pendingCount()).toBe(0);
	});
});
