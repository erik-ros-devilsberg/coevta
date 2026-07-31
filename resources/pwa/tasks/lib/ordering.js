// How the task list is ordered, and what counts as overdue.
//
// Pure functions over the local set — the whole list lives on the device, so
// ordering is ours to decide rather than the server's.

/**
 * Sort key for a due date. The API carries `due_at` either as date-only
 * (`YYYY-MM-DD`) or as an ISO 8601 datetime, and both shapes appear in the same
 * list, so they have to be comparable. Date.parse handles both; anything it
 * cannot read (or a missing date) sinks to the bottom with the undated tasks.
 */
function dueKey(value) {
	const parsed = value ? Date.parse(value) : Number.NaN;

	return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function byTitle(a, b) {
	return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
}

/**
 * Open tasks first, soonest due date first, undated last, ties broken by title.
 * Completed tasks go below, most recently completed first — what you just ticked
 * off is what you are most likely to want to undo.
 *
 * Returns a new array; the caller's list is left alone.
 */
export function sortTasks(tasks) {
	return [...tasks].sort((a, b) => {
		const aDone = Boolean(a.completed_at);
		const bDone = Boolean(b.completed_at);

		if (aDone !== bDone) {
			return aDone ? 1 : -1;
		}

		if (aDone && bDone) {
			return Date.parse(b.completed_at) - Date.parse(a.completed_at) || byTitle(a, b);
		}

		return dueKey(a.due_at) - dueKey(b.due_at) || byTitle(a, b);
	});
}

/** An open task whose due date has passed. Completed tasks are never overdue. */
export function isOverdue(task, now = new Date()) {
	if (task.completed_at || !task.due_at) {
		return false;
	}

	const due = Date.parse(task.due_at);

	return !Number.isNaN(due) && due < now.getTime();
}
