import { describe, it, expect, beforeEach } from 'vitest';

import { memoryKv } from './kv.js';
import { createOutbox, isTempId, newTempId } from './outbox.js';

// The outbox is resource-agnostic — operations carry a recordId and an opaque
// payload — so these tests use a neutral `name` field rather than any one
// resource's shape.

let kv;
let outbox;

beforeEach(() => {
	kv = memoryKv();
	outbox = createOutbox({ kv });
});

const types = async () => (await outbox.list()).map((op) => op.type);

describe('temp ids', () => {
	it('marks locally-created records so sync can tell them from server ids', () => {
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
		await outbox.enqueue({ type: 'create', recordId: 'a', payload: { name: 'A' } });
		await outbox.enqueue({ type: 'update', recordId: 'b', payload: { name: 'B' } });
		await outbox.enqueue({ type: 'delete', recordId: 'c' });

		expect(await types()).toEqual(['create', 'update', 'delete']);
	});

	it('counts pending operations', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: {} });
		await outbox.enqueue({ type: 'update', recordId: 'b', payload: {} });

		expect(await outbox.count()).toBe(2);
	});

	it('survives a restart — a new outbox over the same storage sees the queue', async () => {
		await outbox.enqueue({ type: 'create', recordId: 'a', payload: { name: 'A' } });

		// Same storage, fresh instance: this is what happens when the app is
		// closed and reopened offline. An in-memory queue would lose the edit.
		const restarted = createOutbox({ kv });

		expect(await restarted.count()).toBe(1);
		expect((await restarted.list())[0]).toMatchObject({ type: 'create', recordId: 'a' });
	});

	it('keeps ordering stable across a restart', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: { name: 'first' } });
		await outbox.enqueue({ type: 'update', recordId: 'b', payload: { name: 'second' } });

		const restarted = createOutbox({ kv });
		await restarted.enqueue({ type: 'update', recordId: 'c', payload: { name: 'third' } });

		expect((await restarted.list()).map((op) => op.recordId)).toEqual(['a', 'b', 'c']);
	});
});

describe('remove', () => {
	it('drops a single operation, leaving the rest', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: {} });
		await outbox.enqueue({ type: 'update', recordId: 'b', payload: {} });

		const [first] = await outbox.list();
		await outbox.remove(first.id);

		expect((await outbox.list()).map((op) => op.recordId)).toEqual(['b']);
	});
});

describe('coalescing', () => {
	it('cancels both sides of a create-then-delete', async () => {
		// The record never reached the server, so there is nothing to send.
		await outbox.enqueue({ type: 'create', recordId: 'temp-1', payload: { name: 'Oops' } });
		await outbox.enqueue({ type: 'delete', recordId: 'temp-1' });

		expect(await outbox.list()).toEqual([]);
	});

	it('folds an edit of a not-yet-synced record into its pending create', async () => {
		// Sending an update for an id the server has never seen would 404.
		await outbox.enqueue({ type: 'create', recordId: 'temp-1', payload: { name: 'Draft' } });
		await outbox.enqueue({ type: 'update', recordId: 'temp-1', payload: { name: 'Final' } });

		const ops = await outbox.list();
		expect(ops).toHaveLength(1);
		expect(ops[0]).toMatchObject({ type: 'create', payload: { name: 'Final' } });
	});

	it('collapses repeated edits of the same record to the last value', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: { name: 'One' } });
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: { name: 'Two' } });
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: { name: 'Three' } });

		const ops = await outbox.list();
		expect(ops).toHaveLength(1);
		expect(ops[0].payload).toEqual({ name: 'Three' });
	});

	it('keeps the whole payload when folding, not just the changed fields', async () => {
		// Every queued update carries a complete body: the API's PUT is a full
		// replacement, so a coalesced op that dropped a field would wipe it
		// server-side. For tasks that field is completed_at, and losing it would
		// silently reopen a completed task.
		await outbox.enqueue({
			type: 'update',
			recordId: 'a',
			payload: { name: 'One', completed_at: '2026-07-31T09:00:00Z' },
		});
		await outbox.enqueue({
			type: 'update',
			recordId: 'a',
			payload: { name: 'Two', completed_at: '2026-07-31T09:00:00Z' },
		});

		const ops = await outbox.list();
		expect(ops[0].payload).toEqual({ name: 'Two', completed_at: '2026-07-31T09:00:00Z' });
	});

	it('drops a pending update when the record is then deleted', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: { name: 'Edited' } });
		await outbox.enqueue({ type: 'delete', recordId: 'a' });

		expect(await types()).toEqual(['delete']);
	});

	it('does not coalesce across different records', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: { name: 'A' } });
		await outbox.enqueue({ type: 'update', recordId: 'b', payload: { name: 'B' } });

		expect(await outbox.count()).toBe(2);
	});

	it('keeps a re-create after a delete of the same id', async () => {
		// Distinct intents that happen to share an id — collapsing them would
		// lose the new record.
		await outbox.enqueue({ type: 'delete', recordId: 'a' });
		await outbox.enqueue({ type: 'create', recordId: 'a', payload: { name: 'Again' } });

		expect(await types()).toEqual(['delete', 'create']);
	});
});

describe('remapRecordId', () => {
	it('repoints queued operations from a temp id to the real server id', async () => {
		// Without this, an edit made before the create synced would be sent for
		// an id the server has never heard of.
		await outbox.enqueue({ type: 'update', recordId: 'temp-1', payload: { name: 'Edited' } });
		await outbox.enqueue({ type: 'delete', recordId: 'other' });

		await outbox.remapRecordId('temp-1', 'server-1');

		const ops = await outbox.list();
		expect(ops[0]).toMatchObject({ recordId: 'server-1', type: 'update' });
		expect(ops[1]).toMatchObject({ recordId: 'other' });
	});

	it('preserves ordering when remapping', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'temp-1', payload: {} });
		await outbox.enqueue({ type: 'update', recordId: 'z', payload: {} });

		await outbox.remapRecordId('temp-1', 'server-1');

		expect((await outbox.list()).map((op) => op.recordId)).toEqual(['server-1', 'z']);
	});

	it('is a no-op when nothing references the temp id', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: {} });

		await outbox.remapRecordId('temp-999', 'server-9');

		expect((await outbox.list())[0].recordId).toBe('a');
	});
});

describe('pendingIds', () => {
	it('reports which records have unsynced changes', async () => {
		await outbox.enqueue({ type: 'update', recordId: 'a', payload: {} });
		await outbox.enqueue({ type: 'delete', recordId: 'b' });

		expect([...(await outbox.pendingIds())].sort()).toEqual(['a', 'b']);
	});

	it('is empty once the queue drains', async () => {
		expect([...(await outbox.pendingIds())]).toEqual([]);
	});
});
