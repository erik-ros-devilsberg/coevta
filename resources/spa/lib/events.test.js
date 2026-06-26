import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { listEvents, listAllEvents, createEvent, updateEvent, removeEvent } from './events.js';
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

describe('listEvents', () => {
	it('requests the paginated collection', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: [] } }));
		globalThis.fetch = fetchMock;

		await listEvents(2);

		assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/v1/events?page=2');
	});
});

describe('listAllEvents', () => {
	it('pages through every page and concatenates the results', async () => {
		const pages = {
			1: { data: [{ id: 'a' }], meta: { current_page: 1, last_page: 2 } },
			2: { data: [{ id: 'b' }], meta: { current_page: 2, last_page: 2 } },
		};
		const fetchMock = mock.fn(async (url) => {
			const page = url.endsWith('page=2') ? 2 : 1;
			return fakeResponse({ body: pages[page] });
		});
		globalThis.fetch = fetchMock;

		const all = await listAllEvents();

		assert.equal(fetchMock.mock.calls.length, 2);
		assert.deepEqual(all.map((e) => e.id), ['a', 'b']);
	});
});

describe('createEvent', () => {
	it('POSTs the event payload', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ status: 201, body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await createEvent({ title: 'Standup', start_at: '2026-06-25T09:00:00Z' });

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/events');
		assert.equal(options.method, 'POST');
		assert.deepEqual(JSON.parse(options.body), { title: 'Standup', start_at: '2026-06-25T09:00:00Z' });
	});
});

describe('updateEvent', () => {
	it('PUTs the full replacement payload', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await updateEvent('abc', { title: 'Standup', all_day: true });

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/events/abc');
		assert.equal(options.method, 'PUT');
		assert.equal(JSON.parse(options.body).all_day, true);
	});
});

describe('removeEvent', () => {
	it('DELETEs the event', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ status: 204 }));
		globalThis.fetch = fetchMock;

		await removeEvent('abc');

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/events/abc');
		assert.equal(options.method, 'DELETE');
	});
});
