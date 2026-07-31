import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { listEvents, listAllEvents, createEvent, updateEvent, removeEvent } from './events.js';
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

describe('listEvents', () => {
	it('requests the paginated collection', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: [] } }));
		globalThis.fetch = fetchMock;

		await listEvents(2);

		expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/events?page=2');
	});
});

describe('listAllEvents', () => {
	it('pages through every page and concatenates the results', async () => {
		const pages = {
			1: { data: [{ id: 'a' }], meta: { current_page: 1, last_page: 2 } },
			2: { data: [{ id: 'b' }], meta: { current_page: 2, last_page: 2 } },
		};
		const fetchMock = vi.fn(async (url) => {
			const page = url.endsWith('page=2') ? 2 : 1;
			return fakeResponse({ body: pages[page] });
		});
		globalThis.fetch = fetchMock;

		const all = await listAllEvents();

		expect(fetchMock.mock.calls.length).toBe(2);
		expect(all.map((e) => e.id)).toEqual(['a', 'b']);
	});
});

describe('createEvent', () => {
	it('POSTs the event payload', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ status: 201, body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await createEvent({ title: 'Standup', start_at: '2026-06-25T09:00:00Z' });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/events');
		expect(options.method).toBe('POST');
		expect(JSON.parse(options.body)).toEqual({ title: 'Standup', start_at: '2026-06-25T09:00:00Z' });
	});
});

describe('updateEvent', () => {
	it('PUTs the full replacement payload', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await updateEvent('abc', { title: 'Standup', all_day: true });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/events/abc');
		expect(options.method).toBe('PUT');
		expect(JSON.parse(options.body).all_day).toBe(true);
	});
});

describe('removeEvent', () => {
	it('DELETEs the event', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ status: 204 }));
		globalThis.fetch = fetchMock;

		await removeEvent('abc');

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/events/abc');
		expect(options.method).toBe('DELETE');
	});
});
