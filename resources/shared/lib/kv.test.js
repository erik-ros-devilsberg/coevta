import { describe, it, expect, beforeEach } from 'vitest';

import { memoryKv, createKv } from './kv.js';

// The offline layer talks to storage through this small async interface. Keeping
// it narrow is what lets the sync logic be tested without a browser IndexedDB:
// the memory adapter and the IDB adapter satisfy the same contract.
let kv;

beforeEach(() => {
	kv = memoryKv();
});

describe('kv contract', () => {
	it('returns null for a key that was never set', async () => {
		expect(await kv.get('nope')).toBe(null);
	});

	it('round-trips a stored value', async () => {
		await kv.set('a', { display_name: 'Ada' });

		expect(await kv.get('a')).toEqual({ display_name: 'Ada' });
	});

	it('overwrites an existing key', async () => {
		await kv.set('a', { display_name: 'Ada' });
		await kv.set('a', { display_name: 'Grace' });

		expect(await kv.get('a')).toEqual({ display_name: 'Grace' });
	});

	it('deletes a key', async () => {
		await kv.set('a', { display_name: 'Ada' });
		await kv.del('a');

		expect(await kv.get('a')).toBe(null);
	});

	it('deleting a missing key is a no-op, not an error', async () => {
		await expect(kv.del('ghost')).resolves.toBeUndefined();
	});

	it('lists all values', async () => {
		await kv.set('a', { display_name: 'Ada' });
		await kv.set('b', { display_name: 'Grace' });

		const all = await kv.all();

		expect(all).toHaveLength(2);
		expect(all).toEqual(expect.arrayContaining([{ display_name: 'Ada' }, { display_name: 'Grace' }]));
	});

	it('lists all keys', async () => {
		await kv.set('a', 1);
		await kv.set('b', 2);

		expect((await kv.keys()).sort()).toEqual(['a', 'b']);
	});

	it('clears every key', async () => {
		await kv.set('a', 1);
		await kv.set('b', 2);
		await kv.clear();

		expect(await kv.all()).toEqual([]);
	});

	it('stores a deep copy so later mutation of the caller\'s object does not leak in', async () => {
		const contact = { display_name: 'Ada', tags: ['maths'] };
		await kv.set('a', contact);

		contact.display_name = 'mutated';
		contact.tags.push('leaked');

		expect(await kv.get('a')).toEqual({ display_name: 'Ada', tags: ['maths'] });
	});

	it('returns a copy so mutating a read value does not corrupt the store', async () => {
		await kv.set('a', { display_name: 'Ada' });

		const read = await kv.get('a');
		read.display_name = 'mutated';

		expect(await kv.get('a')).toEqual({ display_name: 'Ada' });
	});
});

describe('createKv', () => {
	it('falls back to the memory adapter where IndexedDB is absent', async () => {
		// jsdom has no IndexedDB; the app must still work (tests, and any browser
		// that blocks storage) rather than throwing on startup.
		const store = createKv({ name: 'coevta-test', store: 'contacts', indexedDB: undefined });

		await store.set('a', { display_name: 'Ada' });

		expect(await store.get('a')).toEqual({ display_name: 'Ada' });
	});
});
