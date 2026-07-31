// Small async key-value store used by the offline layer.
//
// The interface is deliberately narrow — get/set/del/all/keys/clear — because
// that is what lets the sync logic be unit-tested without a browser: the memory
// adapter below satisfies the same contract as the IndexedDB one, so tests run
// against memory while the browser gets real persistence.
//
// Values are structured-cloned in and out (via JSON), so callers can hold on to
// an object and mutate it without corrupting what is stored.

function copy(value) {
	return value === undefined || value === null ? null : JSON.parse(JSON.stringify(value));
}

/**
 * In-memory adapter. Used by the test suite, and as the fallback in browsers
 * where IndexedDB is unavailable or blocked (private mode, storage disabled) —
 * the app still works for the session, it just does not persist.
 */
export function memoryKv() {
	const map = new Map();

	return {
		async get(key) {
			return map.has(key) ? copy(map.get(key)) : null;
		},
		async set(key, value) {
			map.set(key, copy(value));
		},
		async del(key) {
			map.delete(key);
		},
		async all() {
			return [...map.values()].map(copy);
		},
		async keys() {
			return [...map.keys()];
		},
		async clear() {
			map.clear();
		},
	};
}

// Promisify an IDBRequest.
function promisify(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * IndexedDB adapter. Intentionally thin — it holds no logic beyond opening the
 * database and forwarding the six contract methods, so the untestable-in-jsdom
 * surface stays as small as possible.
 */
export function idbKv({ name, store, indexedDB = globalThis.indexedDB }) {
	let dbPromise = null;

	function open() {
		if (!dbPromise) {
			dbPromise = new Promise((resolve, reject) => {
				const request = indexedDB.open(name, 1);
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains(store)) {
						request.result.createObjectStore(store);
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		}

		return dbPromise;
	}

	async function tx(mode, run) {
		const db = await open();
		const objectStore = db.transaction(store, mode).objectStore(store);

		return run(objectStore);
	}

	return {
		async get(key) {
			const value = await tx('readonly', (s) => promisify(s.get(key)));

			return value === undefined ? null : value;
		},
		async set(key, value) {
			await tx('readwrite', (s) => promisify(s.put(copy(value), key)));
		},
		async del(key) {
			await tx('readwrite', (s) => promisify(s.delete(key)));
		},
		async all() {
			return tx('readonly', (s) => promisify(s.getAll()));
		},
		async keys() {
			return tx('readonly', (s) => promisify(s.getAllKeys()));
		},
		async clear() {
			await tx('readwrite', (s) => promisify(s.clear()));
		},
	};
}

/**
 * Pick the best adapter available. Falls back to memory rather than throwing, so
 * a browser without IndexedDB degrades to a working (if non-persistent) app.
 */
export function createKv({ name, store, indexedDB = globalThis.indexedDB } = {}) {
	if (!indexedDB) {
		return memoryKv();
	}

	return idbKv({ name, store, indexedDB });
}
