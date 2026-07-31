import { describe, it, expect, beforeEach, vi } from 'vitest';

import { memoryKv } from '../../../shared/lib/kv.js';
import { createOutbox } from './outbox.js';
import { createSync } from './sync.js';

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
const networkError = () => new TypeError('Failed to fetch');

let contactsKv;
let outbox;
let remote;
let onUnauthorized;
let sync;

beforeEach(() => {
	contactsKv = memoryKv();
	outbox = createOutbox({ kv: memoryKv() });
	remote = {
		create: vi.fn(async (body) => ({ data: { id: 'server-1', ...body } })),
		update: vi.fn(async (id, body) => ({ data: { id, ...body } })),
		remove: vi.fn(async () => null),
	};
	onUnauthorized = vi.fn();
	sync = createSync({ outbox, kv: contactsKv, remote, onUnauthorized });
});

describe('an empty queue', () => {
	it('does nothing', async () => {
		const result = await sync.flush();

		expect(result.rejected).toEqual([]);
		expect(remote.create).not.toHaveBeenCalled();
	});
});

describe('sending', () => {
	it('sends operations in the order they were made', async () => {
		const calls = [];
		remote.create.mockImplementation(async (body) => {
			calls.push('create');
			return { data: { id: 'server-1', ...body } };
		});
		remote.update.mockImplementation(async (id, body) => {
			calls.push('update');
			return { data: { id, ...body } };
		});
		remote.remove.mockImplementation(async () => {
			calls.push('delete');
		});

		await outbox.enqueue({ type: 'create', contactId: 'local-1', payload: { display_name: 'A' } });
		await outbox.enqueue({ type: 'update', contactId: 'srv-b', payload: { display_name: 'B' } });
		await outbox.enqueue({ type: 'delete', contactId: 'srv-c' });

		await sync.flush();

		expect(calls).toEqual(['create', 'update', 'delete']);
	});

	it('empties the queue when everything succeeds', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { display_name: 'A' } });

		await sync.flush();

		expect(await outbox.count()).toBe(0);
	});

	it('applies a delete locally and on the server', async () => {
		await contactsKv.set('srv-a', { id: 'srv-a', display_name: 'A' });
		await outbox.enqueue({ type: 'delete', contactId: 'srv-a' });

		await sync.flush();

		expect(remote.remove).toHaveBeenCalledWith('srv-a');
		expect(await contactsKv.get('srv-a')).toBe(null);
	});

	it('stores the server\'s version of an updated contact', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { display_name: 'Edited' } });

		await sync.flush();

		expect(await contactsKv.get('srv-a')).toMatchObject({ display_name: 'Edited' });
	});
});

describe('creates and temporary ids', () => {
	/**
	 * Hold a create open so the test can act while the POST is genuinely in
	 * flight. `away` resolves once the request has left (waiting a tick would be
	 * a guess about how many awaits the flush takes to get there).
	 */
	function gatedCreate() {
		let release;
		let signalAway;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		const away = new Promise((resolve) => {
			signalAway = resolve;
		});

		remote.create.mockImplementation(async (body) => {
			signalAway();
			await gate;
			return { data: { id: 'server-1', ...body } };
		});

		return { away, release };
	}

	it('replaces the local record with the server\'s, dropping the temp id', async () => {
		await contactsKv.set('local-1', { id: 'local-1', display_name: 'Ada' });
		await outbox.enqueue({ type: 'create', contactId: 'local-1', payload: { display_name: 'Ada' } });

		await sync.flush();

		expect(await contactsKv.get('local-1')).toBe(null);
		expect(await contactsKv.get('server-1')).toMatchObject({ id: 'server-1', display_name: 'Ada' });
	});

	it('folds an edit into the create while both are still queued', async () => {
		await outbox.enqueue({ type: 'create', contactId: 'local-1', payload: { display_name: 'Ada' } });
		await outbox.enqueue({ type: 'update', contactId: 'local-1', payload: { display_name: 'Ada Lovelace' } });

		await sync.flush();

		// One POST carrying the final name — never an update against a temp id.
		expect(remote.create).toHaveBeenCalledWith({ display_name: 'Ada Lovelace' });
		expect(remote.update).not.toHaveBeenCalled();
	});

	it('does not lose an edit made while the create is in flight', async () => {
		// The sharp edge. The POST has already left with the old payload, so
		// folding the edit into that operation would silently drop it. It has to
		// queue separately and then be repointed at the real id.
		const { away, release } = gatedCreate();

		await outbox.enqueue({ type: 'create', contactId: 'local-1', payload: { display_name: 'Ada' } });
		const flushing = sync.flush();
		await away;

		await outbox.enqueue({ type: 'update', contactId: 'local-1', payload: { display_name: 'Ada Lovelace' } });
		release();
		await flushing;
		await sync.flush();

		expect(remote.create).toHaveBeenCalledWith({ display_name: 'Ada' });
		expect(remote.update).toHaveBeenCalledWith('server-1', { display_name: 'Ada Lovelace' });
		expect(await outbox.count()).toBe(0);
	});

	it('repoints a delete made while the create is in flight at the real id', async () => {
		const { away, release } = gatedCreate();

		await outbox.enqueue({ type: 'create', contactId: 'local-1', payload: { display_name: 'Ada' } });
		const flushing = sync.flush();
		await away;

		// Cancelling both is wrong here: the server is about to have this record.
		await outbox.enqueue({ type: 'delete', contactId: 'local-1' });
		release();
		await flushing;
		await sync.flush();

		expect(remote.remove).toHaveBeenCalledWith('server-1');
		expect(await contactsKv.get('server-1')).toBe(null);
	});

	it('clears the in-flight flag when a send fails, so later edits fold again', async () => {
		remote.update.mockRejectedValueOnce(networkError());
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { display_name: 'One' } });
		await sync.flush();

		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { display_name: 'Two' } });

		// A stuck flag would leave two queued updates for the same contact.
		expect(await outbox.count()).toBe(1);
	});

	it('sends a later edit against the real id once the create has synced', async () => {
		await outbox.enqueue({ type: 'create', contactId: 'local-1', payload: { display_name: 'Ada' } });
		await sync.flush();

		// The user edits the contact after it synced — by now it has a real id.
		await outbox.enqueue({ type: 'update', contactId: 'server-1', payload: { display_name: 'Ada Lovelace' } });
		await sync.flush();

		expect(remote.update).toHaveBeenCalledWith('server-1', { display_name: 'Ada Lovelace' });
	});
});

describe('failure handling', () => {
	it('drops an update for a contact the server no longer has, and reconciles locally', async () => {
		await contactsKv.set('gone', { id: 'gone', display_name: 'Deleted elsewhere' });
		remote.update.mockRejectedValue(httpError(404));
		await outbox.enqueue({ type: 'update', contactId: 'gone', payload: { display_name: 'Edit' } });

		await sync.flush();

		expect(await outbox.count()).toBe(0);
		expect(await contactsKv.get('gone')).toBe(null);
	});

	it('treats a 404 on delete as already done', async () => {
		remote.remove.mockRejectedValue(httpError(404));
		await outbox.enqueue({ type: 'delete', contactId: 'gone' });

		await sync.flush();

		expect(await outbox.count()).toBe(0);
	});

	it('does not let a 404 block the operations behind it', async () => {
		remote.update.mockRejectedValueOnce(httpError(404));
		await outbox.enqueue({ type: 'update', contactId: 'gone', payload: {} });
		await outbox.enqueue({ type: 'delete', contactId: 'srv-b' });

		await sync.flush();

		expect(remote.remove).toHaveBeenCalledWith('srv-b');
		expect(await outbox.count()).toBe(0);
	});

	it('drops a rejected operation and reports it rather than retrying forever', async () => {
		remote.update.mockRejectedValue(httpError(422));
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { email: 'nonsense' } });

		const result = await sync.flush();

		// The user has long since moved on; a poison op must not wedge the queue.
		expect(await outbox.count()).toBe(0);
		expect(result.rejected).toHaveLength(1);
		expect(result.rejected[0].op).toMatchObject({ contactId: 'srv-a' });
		expect(result.rejected[0].error.status).toBe(422);
	});

	it('does not let a rejected operation block the ones behind it', async () => {
		remote.update.mockRejectedValueOnce(httpError(422));
		await outbox.enqueue({ type: 'update', contactId: 'bad', payload: {} });
		await outbox.enqueue({ type: 'delete', contactId: 'srv-b' });

		await sync.flush();

		expect(remote.remove).toHaveBeenCalledWith('srv-b');
		expect(await outbox.count()).toBe(0);
	});

	it('leaves an operation queued when the network fails mid-flush', async () => {
		remote.update.mockRejectedValue(networkError());
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: {} });

		const result = await sync.flush();

		expect(await outbox.count()).toBe(1);
		expect(result.stopped).toBe('network');
	});

	it('stops at the first network failure, preserving order for the retry', async () => {
		remote.update.mockRejectedValue(networkError());
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: {} });
		await outbox.enqueue({ type: 'delete', contactId: 'srv-b' });

		await sync.flush();

		// Sending the delete now would apply the edits out of order.
		expect(remote.remove).not.toHaveBeenCalled();
		expect(await outbox.count()).toBe(2);
	});

	it('retries a network-failed operation on the next flush', async () => {
		remote.update.mockRejectedValueOnce(networkError());
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { display_name: 'A' } });

		await sync.flush();
		expect(await outbox.count()).toBe(1);

		await sync.flush();
		expect(await outbox.count()).toBe(0);
	});

	it('stops on a 401 and keeps the queue for after re-auth', async () => {
		remote.update.mockRejectedValue(httpError(401));
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: {} });
		await outbox.enqueue({ type: 'delete', contactId: 'srv-b' });

		const result = await sync.flush();

		expect(onUnauthorized).toHaveBeenCalled();
		expect(result.stopped).toBe('unauthorized');
		// Losing the user's unsynced edits because a token expired would be
		// indefensible.
		expect(await outbox.count()).toBe(2);
	});
});

describe('serialization', () => {
	it('does not double-send when a second flush starts mid-flight', async () => {
		// Gate the in-flight request so both flushes are running at once.
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		remote.update.mockImplementation(async () => {
			await gate;
			return { data: { id: 'srv-a', display_name: 'A' } };
		});
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: { display_name: 'A' } });

		// Start-up flush and the `online` event can land together.
		const first = sync.flush();
		const second = sync.flush();
		release();
		await Promise.all([first, second]);

		expect(remote.update).toHaveBeenCalledTimes(1);
		expect(await outbox.count()).toBe(0);
	});

	it('allows a fresh flush once the previous one has finished', async () => {
		await outbox.enqueue({ type: 'update', contactId: 'srv-a', payload: {} });
		await sync.flush();

		await outbox.enqueue({ type: 'update', contactId: 'srv-b', payload: {} });
		await sync.flush();

		expect(remote.update).toHaveBeenCalledTimes(2);
	});
});
