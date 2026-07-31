import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { listTasks, listAllTasks, createTask, updateTask, completeTask, removeTask, buildTaskBody } from './tasks.js';
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

describe('listTasks', () => {
	it('requests the paginated collection', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: [] } }));
		globalThis.fetch = fetchMock;

		await listTasks(3);

		expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/tasks?page=3');
	});
});

describe('listAllTasks', () => {
	it('pages through the whole collection', async () => {
		// The PWA holds every task on the device — offline reads and the
		// Open/Completed split both need the full set, not one page of it.
		const fetchMock = vi.fn(async (url) => {
			const page = Number(new URL(url, 'http://x').searchParams.get('page'));
			return fakeResponse({
				body: { data: [{ id: `t${page}` }], meta: { current_page: page, last_page: 3 } },
			});
		});
		globalThis.fetch = fetchMock;

		const all = await listAllTasks();

		expect(all.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('treats a response without meta as a single page', async () => {
		// A shape change upstream must not spin this forever.
		globalThis.fetch = vi.fn(async () => fakeResponse({ body: { data: [{ id: 'only' }] } }));

		expect(await listAllTasks()).toHaveLength(1);
	});
});

describe('createTask', () => {
	it('POSTs the task payload', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ status: 201, body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await createTask({ title: 'Write docs' });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/tasks');
		expect(options.method).toBe('POST');
		expect(JSON.parse(options.body)).toEqual({ title: 'Write docs' });
	});
});

describe('completeTask', () => {
	it('POSTs to the complete action with no body', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await completeTask('abc');

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/tasks/abc/complete');
		expect(options.method).toBe('POST');
		expect(options.body).toBe(undefined);
	});
});

describe('updateTask', () => {
	it('PUTs the full replacement payload', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await updateTask('abc', { title: 'X', completed_at: '2026-06-24T12:00:00.000000Z' });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/tasks/abc');
		expect(options.method).toBe('PUT');
	});
});

describe('removeTask', () => {
	it('DELETEs the task', async () => {
		const fetchMock = vi.fn(async () => fakeResponse({ status: 204 }));
		globalThis.fetch = fetchMock;

		await removeTask('abc');

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/tasks/abc');
		expect(options.method).toBe('DELETE');
	});
});

describe('buildTaskBody (PUT is a full replacement)', () => {
	it('keeps completed_at so a completed task stays completed on edit', () => {
		const body = buildTaskBody({ title: 'X', completed_at: '2026-06-24T12:00:00.000000Z' });
		expect(body.completed_at).toBe('2026-06-24T12:00:00.000000Z');
	});

	it('reopens a task when completed_at is omitted', () => {
		const body = buildTaskBody({ title: 'X' });
		expect(body.completed_at).toBe(null);
	});

	it('nulls empty optional fields', () => {
		const body = buildTaskBody({ title: 'X', notes: '', due_at: '' });
		expect(body.notes).toBe(null);
		expect(body.due_at).toBe(null);
	});

	it('always returns every field, so a queued update cannot wipe one', () => {
		// The outbox stores this body verbatim and the API replaces the whole
		// record with it. A missing key here is a field deleted server-side.
		expect(Object.keys(buildTaskBody({ title: 'X' })).sort()).toEqual([
			'completed_at',
			'due_at',
			'notes',
			'title',
		]);
	});

	it('keeps a date-only due date date-only', () => {
		expect(buildTaskBody({ title: 'X', due_at: '2026-08-01' }).due_at).toBe('2026-08-01');
	});

	it('keeps a datetime due date intact', () => {
		expect(buildTaskBody({ title: 'X', due_at: '2026-08-01T09:30:00.000Z' }).due_at).toBe('2026-08-01T09:30:00.000Z');
	});

	it('trims the title', () => {
		expect(buildTaskBody({ title: '  Pay rent  ' }).title).toBe('Pay rent');
	});
});
