// Tasks resource client. Thin wrappers over /tasks, plus a payload builder that
// makes the PUT full-replacement behaviour explicit (resend completed_at to keep
// a task complete; omit it to reopen).

import { apiFetch } from './api.js';

export function listTasks(page = 1) {
	return apiFetch(`/tasks?page=${page}`);
}

/**
 * Page through the whole collection and return every task.
 *
 * The PWA keeps the full set on the device: offline reads need it, and the
 * Open/Completed split is computed client-side from all tasks rather than from
 * whichever page the server handed back. A response without meta is treated as a
 * single page, so a shape change upstream cannot spin this forever.
 */
export async function listAllTasks() {
	const all = [];
	let page = 1;
	let lastPage = 1;

	do {
		const response = await listTasks(page);
		all.push(...(response.data ?? []));
		lastPage = response.meta?.last_page ?? page;
		page += 1;
	} while (page <= lastPage);

	return all;
}

export function getTask(id) {
	return apiFetch(`/tasks/${id}`);
}

export function createTask(data) {
	return apiFetch('/tasks', { method: 'POST', body: data });
}

// Full replacement (PUT-only API).
export function updateTask(id, data) {
	return apiFetch(`/tasks/${id}`, { method: 'PUT', body: data });
}

/**
 * No-body convenience action; the server stamps completed_at = now(). Idempotent.
 *
 * The PWA does not use this: completing offline has to stamp the time the user
 * ticked the box, not the time the queue happened to drain, so the app completes
 * via an ordinary update instead. Kept because it is a documented endpoint other
 * clients may rely on.
 */
export function completeTask(id) {
	return apiFetch(`/tasks/${id}/complete`, { method: 'POST' });
}

export function removeTask(id) {
	return apiFetch(`/tasks/${id}`, { method: 'DELETE' });
}

/**
 * Build the request body for create/update.
 *
 * Always returns every field. Because update is a full replacement, a key left
 * out of this object is a field wiped server-side — and for `completed_at` that
 * means a completed task silently reopening. The offline outbox stores this body
 * verbatim and may hold it for hours before sending it, so it has to be complete
 * at the moment it is built.
 */
export function buildTaskBody({ title = '', notes = '', due_at = null, completed_at = null } = {}) {
	return {
		title: (title ?? '').trim(),
		notes: notes === '' ? null : notes,
		due_at: due_at === '' ? null : due_at,
		completed_at: completed_at === '' ? null : completed_at,
	};
}
