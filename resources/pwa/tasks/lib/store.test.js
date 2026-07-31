import { describe, it, expect, beforeEach, vi } from 'vitest';

import { memoryKv } from '../../../shared/lib/kv.js';
import { isTempId } from '../../../shared/lib/outbox.js';
import { createTasksStore } from './store.js';

const task = (id, title, extra = {}) => ({ id, title, notes: null, due_at: null, completed_at: null, ...extra });

// A fixed clock, so "the moment the user ticked the box" is assertable.
const NOW = '2026-07-31T09:00:00.000Z';

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
	store = createTasksStore({ kv, outboxKv, remote, now: () => NOW });
});

describe('reading', () => {
	it('lists what is on the device, in list order, with no network', async () => {
		await kv.set('b', task('b', 'Beta', { completed_at: '2026-07-30T10:00:00Z' }));
		await kv.set('a', task('a', 'Alpha'));

		expect((await store.cached()).map((t) => t.id)).toEqual(['a', 'b']);
		expect(remote.listAll).not.toHaveBeenCalled();
	});

	it('reads one task from the device', async () => {
		await kv.set('a', task('a', 'Alpha'));

		expect(await store.get('a')).toMatchObject({ title: 'Alpha' });
	});
});

describe('creating offline', () => {
	it('gives a new task a temporary id and shows it immediately', async () => {
		const created = await store.create({ title: 'Pay rent' });

		expect(isTempId(created.id)).toBe(true);
		expect((await store.cached()).map((t) => t.title)).toEqual(['Pay rent']);
		expect(remote.create).not.toHaveBeenCalled();
	});

	it('replaces the temp record with the server\'s when the create syncs', async () => {
		const created = await store.create({ title: 'Pay rent' });

		await store.flush();

		expect(await kv.get(created.id)).toBe(null);
		expect(await kv.get('srv-new')).toMatchObject({ title: 'Pay rent' });
	});
});

describe('completing and reopening', () => {
	it('stamps completed_at from the device clock when the user ticks the box', async () => {
		// Not the moment sync runs — the moment the user acted. The API's own
		// complete action would stamp the former, which is why it is not used.
		await kv.set('a', task('a', 'Alpha'));

		await store.complete(await store.get('a'));

		expect(await kv.get('a')).toMatchObject({ completed_at: NOW });
	});

	it('applies the completion locally before any network call', async () => {
		await kv.set('a', task('a', 'Alpha'));

		await store.complete(await store.get('a'));

		expect(remote.update).not.toHaveBeenCalled();
		expect((await store.cached())[0].completed_at).toBe(NOW);
	});

	it('sends the client stamp on sync, never the no-body complete action', async () => {
		await kv.set('a', task('a', 'Alpha'));
		await store.complete(await store.get('a'));

		await store.flush();

		expect(remote.update).toHaveBeenCalledWith('a', expect.objectContaining({ completed_at: NOW }));
		expect(remote.complete).toBeUndefined();
	});

	it('sends a complete body, so the full-replacement PUT cannot wipe a field', async () => {
		await kv.set('a', task('a', 'Alpha', { notes: 'Some notes', due_at: '2026-08-01' }));
		await store.complete(await store.get('a'));

		await store.flush();

		expect(remote.update).toHaveBeenCalledWith('a', {
			title: 'Alpha',
			notes: 'Some notes',
			due_at: '2026-08-01',
			completed_at: NOW,
		});
	});

	it('clears completed_at when a task is reopened', async () => {
		await kv.set('a', task('a', 'Alpha', { completed_at: '2026-07-30T10:00:00Z' }));

		await store.reopen(await store.get('a'));
		await store.flush();

		expect(await kv.get('a')).toMatchObject({ completed_at: null });
		expect(remote.update).toHaveBeenCalledWith('a', expect.objectContaining({ completed_at: null }));
	});
});

describe('completed_at survives the offline round trip', () => {
	it('keeps the completion when the task is edited afterwards, offline', async () => {
		// The sharpest failure mode in the app: coalescing merges the edit into
		// the queued completion, and an edit body that forgot completed_at would
		// reopen the task server-side without anyone asking for it.
		await kv.set('a', task('a', 'Alpha'));
		await store.complete(await store.get('a'));

		await store.update('a', { title: 'Alpha renamed', notes: null, due_at: null, completed_at: NOW });
		await store.flush();

		expect(remote.update).toHaveBeenCalledTimes(1);
		expect(remote.update).toHaveBeenCalledWith('a', {
			title: 'Alpha renamed',
			notes: null,
			due_at: null,
			completed_at: NOW,
		});
	});

	it('stays completed after a refresh reconciles with the server', async () => {
		await kv.set('a', task('a', 'Alpha'));
		await store.complete(await store.get('a'));

		// The server still has the open version — it has not seen the queued
		// completion yet. Refresh must not overwrite the local one with it.
		server = [task('a', 'Alpha')];
		await store.refresh();

		expect((await store.cached())[0].completed_at).toBe(NOW);
	});

	it('keeps a completion made offline on a task created offline', async () => {
		const created = await store.create({ title: 'New', notes: null, due_at: null, completed_at: null });
		await store.complete(await store.get(created.id));

		await store.flush();

		// One POST carrying the completion — never an update against a temp id.
		expect(remote.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'New', completed_at: NOW }));
		expect(remote.update).not.toHaveBeenCalled();
	});
});

describe('due dates', () => {
	it('keeps a date-only due date date-only through a round trip', async () => {
		await kv.set('a', task('a', 'Alpha'));

		await store.update('a', { title: 'Alpha', notes: null, due_at: '2026-08-01', completed_at: null });
		await store.flush();

		expect(remote.update).toHaveBeenCalledWith('a', expect.objectContaining({ due_at: '2026-08-01' }));
	});

	it('keeps a datetime due date intact through a round trip', async () => {
		await kv.set('a', task('a', 'Alpha'));

		await store.update('a', {
			title: 'Alpha',
			notes: null,
			due_at: '2026-08-01T09:30:00.000Z',
			completed_at: null,
		});
		await store.flush();

		expect(remote.update).toHaveBeenCalledWith('a', expect.objectContaining({ due_at: '2026-08-01T09:30:00.000Z' }));
	});
});

describe('deleting', () => {
	it('removes the task locally at once and on the server when it syncs', async () => {
		await kv.set('a', task('a', 'Alpha'));

		await store.remove('a');
		expect(await store.cached()).toEqual([]);

		await store.flush();
		expect(remote.remove).toHaveBeenCalledWith('a');
	});
});

describe('pending changes', () => {
	it('reports how many changes are waiting and which tasks they touch', async () => {
		await kv.set('a', task('a', 'Alpha'));
		await store.complete(await store.get('a'));

		expect(await store.pendingCount()).toBe(1);
		expect([...(await store.pendingIds())]).toEqual(['a']);
	});

	it('is clear once everything syncs', async () => {
		await kv.set('a', task('a', 'Alpha'));
		await store.complete(await store.get('a'));

		await store.flush();

		expect(await store.pendingCount()).toBe(0);
	});
});
