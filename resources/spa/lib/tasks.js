// Tasks resource client. Thin wrappers over /tasks, plus the no-body complete
// action and a payload builder that makes the PUT full-replacement behaviour
// explicit (resend completed_at to keep a task complete; omit to reopen it).

import { apiFetch } from './api.js';

export function listTasks(page = 1) {
	return apiFetch(`/tasks?page=${page}`);
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

// No-body convenience action; stamps completed_at = now(). Idempotent.
export function completeTask(id) {
	return apiFetch(`/tasks/${id}/complete`, { method: 'POST' });
}

export function removeTask(id) {
	return apiFetch(`/tasks/${id}`, { method: 'DELETE' });
}

/**
 * Build the request body for create/update. Because update is a full
 * replacement, `completed_at` must be carried through to keep a completed task
 * completed — omitting it reopens the task.
 */
export function buildTaskBody({ title = '', notes = '', due_at = null, completed_at = null } = {}) {
	return {
		title: (title ?? '').trim(),
		notes: notes === '' ? null : notes,
		due_at: due_at === '' ? null : due_at,
		completed_at: completed_at === '' ? null : completed_at,
	};
}
