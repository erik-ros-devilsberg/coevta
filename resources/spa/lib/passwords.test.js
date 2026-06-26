import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { resetPassword } from './passwords.js';
import { clearToken } from './api.js';

function fakeResponse({ ok = true, status = 200, body = null } = {}) {
	return { ok, status, json: async () => body };
}

beforeEach(() => {
	clearToken();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('resetPassword', () => {
	it('posts the token, email and new password to the reset endpoint', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { message: 'ok' } }));
		globalThis.fetch = fetchMock;

		await resetPassword({
			email: 'user@example.test',
			token: 'reset-token',
			password: 'brand-new-password',
			passwordConfirmation: 'brand-new-password',
		});

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/reset-password');
		expect(options.method).toBe('POST');

		expect(JSON.parse(options.body)).toEqual({
			email: 'user@example.test',
			token: 'reset-token',
			password: 'brand-new-password',
			password_confirmation: 'brand-new-password',
		});
	});

	it('throws when the token is rejected', async () => {
		globalThis.fetch = vi.fn(async () =>
			fakeResponse({ ok: false, status: 422, body: { message: 'invalid' } }),
		);

		await expect(
			resetPassword({
				email: 'user@example.test',
				token: 'bad',
				password: 'brand-new-password',
				passwordConfirmation: 'brand-new-password',
			}),
		).rejects.toThrow();
	});
});
