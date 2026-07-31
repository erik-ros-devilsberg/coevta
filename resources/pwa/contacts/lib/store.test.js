import { describe, it, expect, beforeEach, vi } from 'vitest';

import { memoryKv } from '../../../shared/lib/kv.js';
import { createContactsStore } from './store.js';
import { isTempId } from '../../../shared/lib/outbox.js';

const contact = (id, display_name) => ({ id, display_name });

let kv;
let outboxKv;
let remote;
let store;

beforeEach(() => {
	kv = memoryKv();
	outboxKv = memoryKv();
	remote = {
		listAll: vi.fn(async () => []),
		create: vi.fn(async (body) => ({ data: { id: 'server-1', ...body } })),
		update: vi.fn(async (id, body) => ({ data: { id, ...body } })),
		remove: vi.fn(async () => null),
	};
	store = createContactsStore({ kv, outboxKv, remote });
});

describe('cached', () => {
	it('is empty before anything has been fetched', async () => {
		expect(await store.cached()).toEqual([]);
	});

	it('returns locally stored contacts without touching the network', async () => {
		await kv.set('1', contact('1', 'Ada'));

		expect(await store.cached()).toEqual([contact('1', 'Ada')]);
		expect(remote.listAll).not.toHaveBeenCalled();
	});

	it('returns them sorted, so the list and scrubber agree', async () => {
		await kv.set('1', contact('1', 'Zoe'));
		await kv.set('2', contact('2', 'Ada'));

		expect((await store.cached()).map((c) => c.display_name)).toEqual(['Ada', 'Zoe']);
	});
});

describe('get', () => {
	it('reads one contact from the device without touching the network', async () => {
		await kv.set('1', contact('1', 'Ada'));

		expect(await store.get('1')).toEqual(contact('1', 'Ada'));
		expect(remote.listAll).not.toHaveBeenCalled();
	});

	it('returns null for a contact that is not on the device', async () => {
		expect(await store.get('missing')).toBe(null);
	});
});

describe('refresh', () => {
	it('pulls the full set from the server and caches it', async () => {
		remote.listAll.mockResolvedValue([contact('1', 'Ada'), contact('2', 'Zoe')]);

		const result = await store.refresh();

		expect(result.map((c) => c.display_name)).toEqual(['Ada', 'Zoe']);
		expect((await kv.all()).map((c) => c.id).sort()).toEqual(['1', '2']);
	});

	it('drops contacts the server no longer has', async () => {
		await kv.set('stale', contact('stale', 'Deleted Elsewhere'));
		remote.listAll.mockResolvedValue([contact('1', 'Ada')]);

		await store.refresh();

		expect(await kv.get('stale')).toBe(null);
	});

	it('updates contacts changed on the server', async () => {
		await kv.set('1', contact('1', 'Old Name'));
		remote.listAll.mockResolvedValue([contact('1', 'New Name')]);

		await store.refresh();

		expect((await kv.get('1')).display_name).toBe('New Name');
	});

	it('leaves the cache intact when the server call fails', async () => {
		await kv.set('1', contact('1', 'Ada'));
		remote.listAll.mockRejectedValue(new Error('offline'));

		await expect(store.refresh()).rejects.toThrow();
		expect((await store.cached()).map((c) => c.id)).toEqual(['1']);
	});

	it('keeps a contact created offline that the server has never heard of', async () => {
		const created = await store.create({ display_name: 'Made offline' });
		remote.listAll.mockResolvedValue([]);

		await store.refresh();

		// Deleting it because the server does not know it yet would throw away
		// the user's work before it ever had a chance to sync.
		expect(await kv.get(created.id)).not.toBe(null);
	});

	it('does not overwrite an unsynced local edit with the server\'s stale copy', async () => {
		await kv.set('1', contact('1', 'Ada'));
		await store.update('1', { display_name: 'Edited offline' });
		remote.listAll.mockResolvedValue([contact('1', 'Ada')]);

		await store.refresh();

		expect((await kv.get('1')).display_name).toBe('Edited offline');
	});
});

describe('create', () => {
	it('shows up immediately under a temporary id, with no network call', async () => {
		const created = await store.create({ display_name: 'Ada' });

		expect(isTempId(created.id)).toBe(true);
		expect(await kv.get(created.id)).toMatchObject({ display_name: 'Ada' });
		expect(remote.create).not.toHaveBeenCalled();
	});

	it('queues the create for sync', async () => {
		await store.create({ display_name: 'Ada' });

		expect(await store.pendingCount()).toBe(1);
	});

	it('is replaced by the server record once flushed', async () => {
		const created = await store.create({ display_name: 'Ada' });

		await store.flush();

		expect(await kv.get(created.id)).toBe(null);
		expect(await kv.get('server-1')).toMatchObject({ id: 'server-1', display_name: 'Ada' });
		expect(await store.pendingCount()).toBe(0);
	});
});

describe('update', () => {
	it('applies locally and queues, with no network call', async () => {
		await kv.set('1', contact('1', 'Ada'));

		await store.update('1', { display_name: 'Ada Lovelace' });

		expect((await kv.get('1')).display_name).toBe('Ada Lovelace');
		expect(remote.update).not.toHaveBeenCalled();
		expect(await store.pendingCount()).toBe(1);
	});

	it('sends the edit on flush', async () => {
		await kv.set('1', contact('1', 'Ada'));
		await store.update('1', { display_name: 'Ada Lovelace' });

		await store.flush();

		expect(remote.update).toHaveBeenCalledWith('1', { display_name: 'Ada Lovelace' });
		expect(await store.pendingCount()).toBe(0);
	});
});

describe('remove', () => {
	it('disappears locally and queues, with no network call', async () => {
		await kv.set('1', contact('1', 'Ada'));

		await store.remove('1');

		expect(await kv.get('1')).toBe(null);
		expect(remote.remove).not.toHaveBeenCalled();
		expect(await store.pendingCount()).toBe(1);
	});

	it('sends the delete on flush', async () => {
		await kv.set('1', contact('1', 'Ada'));
		await store.remove('1');

		await store.flush();

		expect(remote.remove).toHaveBeenCalledWith('1');
	});

	it('sends nothing for a contact created and deleted before syncing', async () => {
		const created = await store.create({ display_name: 'Oops' });
		await store.remove(created.id);

		await store.flush();

		expect(remote.create).not.toHaveBeenCalled();
		expect(remote.remove).not.toHaveBeenCalled();
		expect(await store.pendingCount()).toBe(0);
	});
});

describe('pending state', () => {
	it('reports which contacts have unsynced changes', async () => {
		await kv.set('1', contact('1', 'Ada'));
		await store.update('1', { display_name: 'Edited' });

		expect([...(await store.pendingIds())]).toEqual(['1']);
	});

	it('clears once everything syncs', async () => {
		await kv.set('1', contact('1', 'Ada'));
		await store.update('1', { display_name: 'Edited' });

		await store.flush();

		expect([...(await store.pendingIds())]).toEqual([]);
		expect(await store.pendingCount()).toBe(0);
	});

	it('survives a restart — a new store over the same storage still has the queue', async () => {
		await store.create({ display_name: 'Made offline' });

		// Closing the app with unsynced edits must not lose them.
		const restarted = createContactsStore({ kv, outboxKv, remote });

		expect(await restarted.pendingCount()).toBe(1);

		await restarted.flush();
		expect(remote.create).toHaveBeenCalledWith({ display_name: 'Made offline' });
	});
});
