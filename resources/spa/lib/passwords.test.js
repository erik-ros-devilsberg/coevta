import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { resetPassword } from './passwords.js';
import { clearToken } from './api.js';

function fakeResponse({ ok = true, status = 200, body = null } = {}) {
	return { ok, status, json: async () => body };
}

beforeEach(() => {
	clearToken();
});

afterEach(() => {
	mock.restoreAll();
});

describe('resetPassword', () => {
	it('posts the token, email and new password to the reset endpoint', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { message: 'ok' } }));
		globalThis.fetch = fetchMock;

		await resetPassword({
			email: 'user@example.test',
			token: 'reset-token',
			password: 'brand-new-password',
			passwordConfirmation: 'brand-new-password',
		});

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/reset-password');
		assert.equal(options.method, 'POST');

		const sent = JSON.parse(options.body);
		assert.deepEqual(sent, {
			email: 'user@example.test',
			token: 'reset-token',
			password: 'brand-new-password',
			password_confirmation: 'brand-new-password',
		});
	});

	it('throws when the token is rejected', async () => {
		globalThis.fetch = mock.fn(async () =>
			fakeResponse({ ok: false, status: 422, body: { message: 'invalid' } }),
		);

		await assert.rejects(() =>
			resetPassword({
				email: 'user@example.test',
				token: 'bad',
				password: 'brand-new-password',
				passwordConfirmation: 'brand-new-password',
			}),
		);
	});
});
