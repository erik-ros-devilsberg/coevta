import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { listContacts, getContact, createContact, updateContact, removeContact } from './contacts.js';
import { clearToken, setToken } from './api.js';

function fakeResponse({ ok = true, status = 200, body = null } = {}) {
	return { ok, status, json: async () => body };
}

beforeEach(() => {
	clearToken();
});

afterEach(() => {
	mock.restoreAll();
});

describe('listContacts', () => {
	it('requests the paginated collection for the given page', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: [], meta: {} } }));
		globalThis.fetch = fetchMock;

		await listContacts(2);

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/contacts?page=2');
		assert.equal(options.method ?? 'GET', 'GET');
	});

	it('defaults to page 1', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: [] } }));
		globalThis.fetch = fetchMock;

		await listContacts();

		assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/v1/contacts?page=1');
	});
});

describe('getContact', () => {
	it('requests a single contact by id', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: { id: 'abc' } } }));
		globalThis.fetch = fetchMock;

		await getContact('abc');

		assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/v1/contacts/abc');
	});
});

describe('createContact', () => {
	it('POSTs the contact payload', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ status: 201, body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await createContact({ display_name: 'Ada Lovelace', email: 'ada@example.test' });

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/contacts');
		assert.equal(options.method, 'POST');
		assert.deepEqual(JSON.parse(options.body), {
			display_name: 'Ada Lovelace',
			email: 'ada@example.test',
		});
	});

	it('surfaces 422 validation errors', async () => {
		globalThis.fetch = mock.fn(async () =>
			fakeResponse({ ok: false, status: 422, body: { message: 'invalid', errors: { display_name: ['required'] } } }),
		);

		await assert.rejects(() => createContact({}), (err) => {
			assert.equal(err.status, 422);
			assert.deepEqual(err.data.errors.display_name, ['required']);
			return true;
		});
	});
});

describe('updateContact', () => {
	it('PUTs the full replacement payload to the contact', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await updateContact('abc', { display_name: 'Grace Hopper' });

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/contacts/abc');
		assert.equal(options.method, 'PUT');
		assert.deepEqual(JSON.parse(options.body), { display_name: 'Grace Hopper' });
	});
});

describe('removeContact', () => {
	it('DELETEs the contact', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ status: 204 }));
		globalThis.fetch = fetchMock;

		await removeContact('abc');

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/contacts/abc');
		assert.equal(options.method, 'DELETE');
	});
});

describe('401 handling', () => {
	it('clears the token and throws on an expired session', async () => {
		setToken('stale-token');
		globalThis.fetch = mock.fn(async () => fakeResponse({ ok: false, status: 401, body: { message: 'Unauthenticated.' } }));

		await assert.rejects(() => listContacts(), (err) => {
			assert.equal(err.status, 401);
			return true;
		});
		// apiFetch clears the token on 401 so the guard can redirect to login.
		const { getToken } = await import('./api.js');
		assert.equal(getToken(), null);
	});
});
