import { describe, it, expect } from 'vitest';

import { sortTasks, isOverdue } from './ordering.js';

const ids = (tasks) => sortTasks(tasks).map((t) => t.id);

describe('sortTasks', () => {
	it('puts open tasks before completed ones', () => {
		const tasks = [
			{ id: 'done', title: 'A', completed_at: '2026-07-30T10:00:00Z' },
			{ id: 'open', title: 'B', completed_at: null },
		];

		expect(ids(tasks)).toEqual(['open', 'done']);
	});

	it('orders open tasks by due date, soonest first', () => {
		const tasks = [
			{ id: 'later', title: 'B', due_at: '2026-08-10', completed_at: null },
			{ id: 'sooner', title: 'A', due_at: '2026-08-01', completed_at: null },
		];

		expect(ids(tasks)).toEqual(['sooner', 'later']);
	});

	it('compares a date-only due date against a datetime one', () => {
		// The API hands back both shapes for the same field, so ordering cannot
		// assume either.
		const tasks = [
			{ id: 'datetime', title: 'B', due_at: '2026-08-01T09:00:00.000Z', completed_at: null },
			{ id: 'dateonly', title: 'A', due_at: '2026-07-31', completed_at: null },
		];

		expect(ids(tasks)).toEqual(['dateonly', 'datetime']);
	});

	it('sinks tasks with no due date below dated ones', () => {
		const tasks = [
			{ id: 'undated', title: 'A', due_at: null, completed_at: null },
			{ id: 'dated', title: 'B', due_at: '2026-12-31', completed_at: null },
		];

		expect(ids(tasks)).toEqual(['dated', 'undated']);
	});

	it('falls back to title for tasks that are otherwise equal', () => {
		const tasks = [
			{ id: 'b', title: 'beta', due_at: null, completed_at: null },
			{ id: 'a', title: 'Alpha', due_at: null, completed_at: null },
		];

		// Case-insensitive: "Alpha" before "beta", not after it.
		expect(ids(tasks)).toEqual(['a', 'b']);
	});

	it('shows the most recently completed task first', () => {
		const tasks = [
			{ id: 'older', title: 'A', completed_at: '2026-07-01T10:00:00Z' },
			{ id: 'newer', title: 'B', completed_at: '2026-07-30T10:00:00Z' },
		];

		expect(ids(tasks)).toEqual(['newer', 'older']);
	});

	it('does not mutate the array it is given', () => {
		const tasks = [
			{ id: 'b', title: 'B', completed_at: '2026-07-30T10:00:00Z' },
			{ id: 'a', title: 'A', completed_at: null },
		];

		sortTasks(tasks);

		expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
	});

	it('survives an unparseable due date rather than throwing', () => {
		const tasks = [
			{ id: 'bad', title: 'A', due_at: 'not-a-date', completed_at: null },
			{ id: 'good', title: 'B', due_at: '2026-08-01', completed_at: null },
		];

		// Garbage sorts with the undated tasks; it must never break the list.
		expect(ids(tasks)).toEqual(['good', 'bad']);
	});

	it('handles an empty list', () => {
		expect(sortTasks([])).toEqual([]);
	});
});

describe('isOverdue', () => {
	const now = new Date('2026-07-31T12:00:00Z');

	it('flags an open task whose due date has passed', () => {
		expect(isOverdue({ due_at: '2026-07-30', completed_at: null }, now)).toBe(true);
	});

	it('does not flag a task due later', () => {
		expect(isOverdue({ due_at: '2026-08-05', completed_at: null }, now)).toBe(false);
	});

	it('never flags a completed task', () => {
		expect(isOverdue({ due_at: '2026-07-01', completed_at: '2026-07-02T10:00:00Z' }, now)).toBe(false);
	});

	it('never flags a task with no due date', () => {
		expect(isOverdue({ due_at: null, completed_at: null }, now)).toBe(false);
	});
});
