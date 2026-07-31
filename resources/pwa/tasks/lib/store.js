// The tasks app's offline store: the shared offline machinery, wired to the
// tasks remote and this app's ordering, plus the two task-specific writes
// (complete and reopen).
//
// Everything else lives in shared/lib/store.js — see it (and sync.js) for how
// offline writes, the outbox and last-write-wins actually behave.

import { createKv } from '../../../shared/lib/kv.js';
import {
	listAllTasks,
	createTask,
	updateTask,
	removeTask,
	buildTaskBody,
} from '../../../shared/lib/tasks.js';
import { createOfflineStore } from '../../../shared/lib/store.js';
import { sortTasks } from './ordering.js';

export const DB_NAME = 'coevta-tasks';
export const STORE_NAME = 'tasks';
export const OUTBOX_STORE = 'outbox';

const defaultRemote = {
	listAll: listAllTasks,
	create: createTask,
	update: updateTask,
	remove: removeTask,
};

export function createTasksStore({
	kv = createKv({ name: DB_NAME, store: STORE_NAME }),
	outboxKv = createKv({ name: DB_NAME, store: OUTBOX_STORE }),
	remote = defaultRemote,
	// Injectable so tests can assert the exact stamp; see complete() below.
	now = () => new Date().toISOString(),
	onUnauthorized,
} = {}) {
	const store = createOfflineStore({ kv, outboxKv, remote, sort: sortTasks, onUnauthorized });

	/**
	 * Mark a task done.
	 *
	 * The API has a no-body complete action that stamps `completed_at` server-side,
	 * but it is useless offline: it would record the moment the queue happened to
	 * drain, which could be days after the user ticked the box. So completion is
	 * an ordinary update carrying a client stamp, and behaves identically whether
	 * or not there is a connection.
	 *
	 * The body is built from the whole task, not just the changed field, because
	 * the API's PUT replaces the record — anything omitted here is wiped.
	 */
	function complete(task) {
		return store.update(task.id, buildTaskBody({ ...task, completed_at: now() }));
	}

	/** Reopen a task: same full-body update, with the completion cleared. */
	function reopen(task) {
		return store.update(task.id, buildTaskBody({ ...task, completed_at: null }));
	}

	return { ...store, complete, reopen };
}
