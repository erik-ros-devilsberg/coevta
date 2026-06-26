import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { listContacts, getContact, createContact, updateContact, removeContact } from './contacts.js';
import { clearToken, getToken, setToken } from './api.js';

function fakeResponse({ ok = true, status = 200, body = null } = {}) {
	return { ok, status, json: async () => body };
}

beforeEach(() => {
	clearToken();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('listContacts', () => {
	it('requests the paginated collection for the given page', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: [], meta: {} } }));
		globalThis.fetch = fetchMock;

		await listContacts(2);

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/contacts?page=2');
		expect(options.method ?? 'GET').toBe('GET');
	});

	it('defaults to page 1', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: [] } }));
		globalThis.fetch = fetchMock;

		await listContacts();

		expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/contacts?page=1');
	});
});

describe('getContact', () => {
	it('requests a single contact by id', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: { id: 'abc' } } }));
		globalThis.fetch = fetchMock;

		await getContact('abc');

		expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/contacts/abc');
	});
});

describe('createContact', () => {
	it('POSTs the contact payload', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ status: 201, body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await createContact({ display_name: 'Ada Lovelace', email: 'ada@example.test' });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/contacts');
		expect(options.method).toBe('POST');
		expect(JSON.parse(options.body)).toEqual({
			display_name: 'Ada Lovelace',
			email: 'ada@example.test',
		});
	});

	it('surfaces 422 validation errors', async () => {
		globalThis.fetch = vi.fn(async () =>
			fakeResponse({ ok: false, status: 422, body: { message: 'invalid', errors: { display_name: ['required'] } } }),
		);

		await expect(createContact({})).rejects.toMatchObject({
			status: 422,
			data: { errors: { display_name: ['required'] } },
		});
	});
});

describe('updateContact', () => {
	it('PUTs the full replacement payload to the contact', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await updateContact('abc', { display_name: 'Grace Hopper' });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/contacts/abc');
		expect(options.method).toBe('PUT');
		expect(JSON.parse(options.body)).toEqual({ display_name: 'Grace Hopper' });
	});
});

describe('removeContact', () => {
	it('DELETEs the contact', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ status: 204 }));
		globalThis.fetch = fetchMock;

		await removeContact('abc');

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/contacts/abc');
		expect(options.method).toBe('DELETE');
	});
});

describe('401 handling', () => {
	it('clears the token and throws on an expired session', async () => {
		setToken('stale-token');
		globalThis.fetch = vi.fn(async () => fakeResponse({ ok: false, status: 401, body: { message: 'Unauthenticated.' } }));

		await expect(listContacts()).rejects.toMatchObject({ status: 401 });
		// apiFetch clears the token on 401 so the guard can redirect to login.
		expect(getToken()).toBe(null);
	});
});
