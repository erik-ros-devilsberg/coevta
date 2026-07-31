import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isAuthenticatedMock } = vi.hoisted(() => ({ isAuthenticatedMock: vi.fn() }));
vi.mock('../../shared/lib/auth.js', () => ({ isAuthenticated: isAuthenticatedMock }));

import router, { BASE } from './router.js';

beforeEach(() => {
	isAuthenticatedMock.mockReset();
});

async function visit(path) {
	await router.push(path);
	await router.isReady();

	return router.currentRoute.value;
}

describe('scope', () => {
	it('is based at /tasks/, so every route stays inside the service worker scope', () => {
		// A navigation outside the scope drops an installed app into a browser
		// tab — which is why this app carries its own login rather than sharing
		// the legacy SPA's at /login.
		expect(BASE).toBe('/tasks/');
	});

	it('does not share the contacts app\'s scope', () => {
		expect(BASE).not.toBe('/contacts/');
	});
});

describe('auth guard', () => {
	it('sends a tokenless visitor to the in-scope login', async () => {
		isAuthenticatedMock.mockReturnValue(false);

		expect((await visit('/')).path).toBe('/login');
	});

	it('lets an authenticated visitor through', async () => {
		isAuthenticatedMock.mockReturnValue(true);

		expect((await visit('/')).path).toBe('/');
	});

	it('leaves the login route reachable without a token', async () => {
		isAuthenticatedMock.mockReturnValue(false);

		expect((await visit('/login')).path).toBe('/login');
	});

	it('redirects an unknown path to the list rather than 404ing', async () => {
		isAuthenticatedMock.mockReturnValue(true);

		expect((await visit('/nonsense/deep/link')).path).toBe('/');
	});
});
