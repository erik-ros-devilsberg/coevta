import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { login, logout, isAuthenticated } from './auth.js';
import { clearToken, getToken } from './api.js';

function fakeResponse({ ok = true, status = 200, body = null } = {}) {
	return { ok, status, json: async () => body };
}

beforeEach(() => {
	clearToken();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('login', () => {
	it('stores the token returned by the API on success', async () => {
		globalThis.fetch = vi.fn(async () => fakeResponse({ body: { token: 'abc123' } }));

		await login('user@example.test', 'secret-pass');

		expect(getToken()).toBe('abc123');
		expect(isAuthenticated()).toBe(true);
	});

	it('throws and stores no token on invalid credentials', async () => {
		globalThis.fetch = vi.fn(async () =>
			fakeResponse({ ok: false, status: 401, body: { message: 'nope' } }),
		);

		await expect(login('user@example.test', 'wrong')).rejects.toThrow();
		expect(getToken()).toBe(null);
		expect(isAuthenticated()).toBe(false);
	});
});

describe('logout', () => {
	it('clears the stored token', async () => {
		globalThis.fetch = vi.fn(async () => fakeResponse({ body: { token: 'tok' } }));
		await login('user@example.test', 'secret-pass');
		expect(isAuthenticated()).toBe(true);

		globalThis.fetch = vi.fn(async () => fakeResponse({ status: 204 }));
		await logout();

		expect(getToken()).toBe(null);
	});
});
