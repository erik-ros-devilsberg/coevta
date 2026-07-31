import { describe, it, expect, beforeEach } from 'vitest';

import { memoryKv } from '../../../shared/lib/kv.js';
import { createOutbox, isTempId, newTempId } from './outbox.js';

let kv;
let outbox;

beforeEach(() => {
	kv = memoryKv();
	outbox = createOutbox({ kv });
});

const types = async () => (await outbox.list()).map((op) => op.type);

describe('temp ids', () => {
	it('marks locally-created contacts so sync can tell them from server ids', () => {
		const id = newTempId();

		expect(isTempId(id)).toBe(true);
		expect(isTempId('0190f8c2-1e3d-7000-8000-000000000000')).toBe(false);
	});

	it('does not collide across calls', () => {
		const ids = new Set(Array.from({ length: 200 }, () => newTempId()));

		expect(ids.size).toBe(200);
	});
});

describe('enqueue and list', () => {
	it('is empty to start with', async () => {
		expect(await outbox.list()).toEqual([]);
		expect(await outbox.count()).toBe(0);
	});

	it('keeps operations in the order they were made', async () => {
		await outbox.enqueue({ type: 'create', contactId: 'a', payload: { display_name: 'A' } });
		await outbox.enqueue({ type: 'update', contactId: 'b', payload: { display_name: 'B' } });
		await outbox.enqueue({ type: 'delete', contactId: 'c' });

		expect(await types()).toEqual(['create', 'update', 'delete']);
	});

	it('counts pending operations', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: {} });
		await outbox.enqueue({ type: 'update', contactId: 'b', payload: {} });

		expect(await outbox.count()).toBe(2);
	});

	it('survives a restart — a new outbox over the same storage sees the queue', async () => {
		await outbox.enqueue({ type: 'create', contactId: 'a', payload: { display_name: 'A' } });

		// Same storage, fresh instance: this is what happens when the app is
		// closed and reopened offline. An in-memory queue would lose the edit.
		const restarted = createOutbox({ kv });

		expect(await restarted.count()).toBe(1);
		expect((await restarted.list())[0]).toMatchObject({ type: 'create', contactId: 'a' });
	});

	it('keeps ordering stable across a restart', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: { display_name: 'first' } });
		await outbox.enqueue({ type: 'update', contactId: 'b', payload: { display_name: 'second' } });

		const restarted = createOutbox({ kv });
		await restarted.enqueue({ type: 'update', contactId: 'c', payload: { display_name: 'third' } });

		expect((await restarted.list()).map((op) => op.contactId)).toEqual(['a', 'b', 'c']);
	});
});

describe('remove', () => {
	it('drops a single operation, leaving the rest', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: {} });
		await outbox.enqueue({ type: 'update', contactId: 'b', payload: {} });

		const [first] = await outbox.list();
		await outbox.remove(first.id);

		expect((await outbox.list()).map((op) => op.contactId)).toEqual(['b']);
	});
});

describe('coalescing', () => {
	it('cancels both sides of a create-then-delete', async () => {
		// The contact never reached the server, so there is nothing to send.
		await outbox.enqueue({ type: 'create', contactId: 'temp-1', payload: { display_name: 'Oops' } });
		await outbox.enqueue({ type: 'delete', contactId: 'temp-1' });

		expect(await outbox.list()).toEqual([]);
	});

	it('folds an edit of a not-yet-synced contact into its pending create', async () => {
		// Sending an update for an id the server has never seen would 404.
		await outbox.enqueue({ type: 'create', contactId: 'temp-1', payload: { display_name: 'Draft' } });
		await outbox.enqueue({ type: 'update', contactId: 'temp-1', payload: { display_name: 'Final' } });

		const ops = await outbox.list();
		expect(ops).toHaveLength(1);
		expect(ops[0]).toMatchObject({ type: 'create', payload: { display_name: 'Final' } });
	});

	it('collapses repeated edits of the same contact to the last value', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: { display_name: 'One' } });
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: { display_name: 'Two' } });
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: { display_name: 'Three' } });

		const ops = await outbox.list();
		expect(ops).toHaveLength(1);
		expect(ops[0].payload).toEqual({ display_name: 'Three' });
	});

	it('drops a pending update when the contact is then deleted', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: { display_name: 'Edited' } });
		await outbox.enqueue({ type: 'delete', contactId: 'a' });

		expect(await types()).toEqual(['delete']);
	});

	it('does not coalesce across different contacts', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: { display_name: 'A' } });
		await outbox.enqueue({ type: 'update', contactId: 'b', payload: { display_name: 'B' } });

		expect(await outbox.count()).toBe(2);
	});

	it('keeps a re-create after a delete of the same id', async () => {
		// Distinct intents that happen to share an id — collapsing them would
		// lose the new contact.
		await outbox.enqueue({ type: 'delete', contactId: 'a' });
		await outbox.enqueue({ type: 'create', contactId: 'a', payload: { display_name: 'Again' } });

		expect(await types()).toEqual(['delete', 'create']);
	});
});

describe('remapContactId', () => {
	it('repoints queued operations from a temp id to the real server id', async () => {
		// Without this, an edit made before the create synced would be sent for
		// an id the server has never heard of.
		await outbox.enqueue({ type: 'update', contactId: 'temp-1', payload: { display_name: 'Edited' } });
		await outbox.enqueue({ type: 'delete', contactId: 'other' });

		await outbox.remapContactId('temp-1', 'server-1');

		const ops = await outbox.list();
		expect(ops[0]).toMatchObject({ contactId: 'server-1', type: 'update' });
		expect(ops[1]).toMatchObject({ contactId: 'other' });
	});

	it('preserves ordering when remapping', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'temp-1', payload: {} });
		await outbox.enqueue({ type: 'update', contactId: 'z', payload: {} });

		await outbox.remapContactId('temp-1', 'server-1');

		expect((await outbox.list()).map((op) => op.contactId)).toEqual(['server-1', 'z']);
	});

	it('is a no-op when nothing references the temp id', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: {} });

		await outbox.remapContactId('temp-999', 'server-9');

		expect((await outbox.list())[0].contactId).toBe('a');
	});
});

describe('pendingIds', () => {
	it('reports which contacts have unsynced changes', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'a', payload: {} });
		await outbox.enqueue({ type: 'delete', contactId: 'b' });

		expect([...(await outbox.pendingIds())].sort()).toEqual(['a', 'b']);
	});

	it('is empty once the queue drains', async () => {
		expect([...(await outbox.pendingIds())]).toEqual([]);
	});
});
