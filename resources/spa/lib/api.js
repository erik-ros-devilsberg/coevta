// Thin API client for the SPA. Holds the Sanctum bearer token client-side and
// attaches it to every request. The token lives in localStorage in the browser;
// a tiny in-memory fallback keeps the module usable (and testable) where
// localStorage is absent (e.g. the Node test runner).

const TOKEN_KEY = 'coevta_token';
const API_BASE = '/api/v1';

function createMemoryStore() {
	const map = new Map();

	return {
		getItem: (key) => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => map.set(key, String(value)),
		removeItem: (key) => map.delete(key),
	};
}

const store = globalThis.localStorage ?? createMemoryStore();

export function getToken() {
	return store.getItem(TOKEN_KEY);
}

export function setToken(token) {
	store.setItem(TOKEN_KEY, token);
}

export function clearToken() {
	store.removeItem(TOKEN_KEY);
}

/**
 * Make a JSON request against the API. Attaches the bearer token when present,
 * clears it on a 401, and throws an Error (carrying status + parsed body) for
 * any non-2xx response so callers can handle failures with try/catch.
 */
export async function apiFetch(path, options = {}) {
	const headers = { Accept: 'application/json', ...(options.headers || {}) };

	const hasBody = options.body !== undefined;
	if (hasBody) {
		headers['Content-Type'] = 'application/json';
	}

	const token = getToken();
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
		body: hasBody ? JSON.stringify(options.body) : undefined,
	});

	if (response.status === 401) {
		clearToken();
	}

	const data = response.status === 204 ? null : await response.json().catch(() => null);

	if (!response.ok) {
		const error = new Error((data && data.message) || 'Request failed');
		error.status = response.status;
		error.data = data;
		throw error;
	}

	return data;
}
