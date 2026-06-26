import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { listTasks, createTask, updateTask, completeTask, removeTask, buildTaskBody } from './tasks.js';
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

describe('listTasks', () => {
	it('requests the paginated collection', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: [] } }));
		globalThis.fetch = fetchMock;

		await listTasks(3);

		assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/v1/tasks?page=3');
	});
});

describe('createTask', () => {
	it('POSTs the task payload', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ status: 201, body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await createTask({ title: 'Write docs' });

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/tasks');
		assert.equal(options.method, 'POST');
		assert.deepEqual(JSON.parse(options.body), { title: 'Write docs' });
	});
});

describe('completeTask', () => {
	it('POSTs to the complete action with no body', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await completeTask('abc');

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/tasks/abc/complete');
		assert.equal(options.method, 'POST');
		assert.equal(options.body, undefined);
	});
});

describe('updateTask', () => {
	it('PUTs the full replacement payload', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ body: { data: {} } }));
		globalThis.fetch = fetchMock;

		await updateTask('abc', { title: 'X', completed_at: '2026-06-24T12:00:00.000000Z' });

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/tasks/abc');
		assert.equal(options.method, 'PUT');
	});
});

describe('removeTask', () => {
	it('DELETEs the task', async () => {
		const fetchMock = mock.fn(async () => fakeResponse({ status: 204 }));
		globalThis.fetch = fetchMock;

		await removeTask('abc');

		const [url, options] = fetchMock.mock.calls[0].arguments;
		assert.equal(url, '/api/v1/tasks/abc');
		assert.equal(options.method, 'DELETE');
	});
});

describe('buildTaskBody (PUT is a full replacement)', () => {
	it('keeps completed_at so a completed task stays completed on edit', () => {
		const body = buildTaskBody({ title: 'X', completed_at: '2026-06-24T12:00:00.000000Z' });
		assert.equal(body.completed_at, '2026-06-24T12:00:00.000000Z');
	});

	it('reopens a task when completed_at is omitted', () => {
		const body = buildTaskBody({ title: 'X' });
		assert.equal(body.completed_at, null);
	});

	it('nulls empty optional fields', () => {
		const body = buildTaskBody({ title: 'X', notes: '', due_at: '' });
		assert.equal(body.notes, null);
		assert.equal(body.due_at, null);
	});
});
