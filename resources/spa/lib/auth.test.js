import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { login, logout, isAuthenticated } from './auth.js';
import { clearToken, getToken } from './api.js';

function fakeResponse({ ok = true, status = 200, body = null } = {}) {
	return { ok, status, json: async () => body };
}

beforeEach(() => {
	clearToken();
});

afterEach(() => {
	mock.restoreAll();
});

describe('login', () => {
	it('stores the token returned by the API on success', async () => {
		globalThis.fetch = mock.fn(async () => fakeResponse({ body: { token: 'abc123' } }));

		await login('user@example.test', 'secret-pass');

		assert.equal(getToken(), 'abc123');
		assert.equal(isAuthenticated(), true);
	});

	it('throws and stores no token on invalid credentials', async () => {
		globalThis.fetch = mock.fn(async () =>
			fakeResponse({ ok: false, status: 401, body: { message: 'nope' } }),
		);

		await assert.rejects(() => login('user@example.test', 'wrong'));
		assert.equal(getToken(), null);
		assert.equal(isAuthenticated(), false);
	});
});

describe('logout', () => {
	it('clears the stored token', async () => {
		globalThis.fetch = mock.fn(async () => fakeResponse({ status: 204 }));
		// Seed a token as if previously logged in.
		globalThis.fetch = mock.fn(async () => fakeResponse({ body: { token: 'tok' } }));
		await login('user@example.test', 'secret-pass');
		assert.equal(isAuthenticated(), true);

		globalThis.fetch = mock.fn(async () => fakeResponse({ status: 204 }));
		await logout();

		assert.equal(getToken(), null);
	});
});
