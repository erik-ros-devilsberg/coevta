import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { daysInMonth, monthMatrix, groupByDay, shiftMonth } from './month.js';

describe('daysInMonth', () => {
	it('counts days, including leap February', () => {
		assert.equal(daysInMonth(2026, 5), 30); // June
		assert.equal(daysInMonth(2026, 1), 28); // Feb 2026 (non-leap)
		assert.equal(daysInMonth(2024, 1), 29); // Feb 2024 (leap)
	});
});

describe('monthMatrix', () => {
	const weeks = monthMatrix(2026, 5, '2026-06-15'); // June 2026
	const cells = weeks.flat();

	it('returns full weeks of seven days', () => {
		for (const week of weeks) {
			assert.equal(week.length, 7);
		}
		assert.equal(cells.length % 7, 0);
	});

	it('contains exactly the days of the month as in-month cells', () => {
		const inMonth = cells.filter((c) => c.inMonth);
		assert.equal(inMonth.length, 30);
		assert.equal(inMonth[0].key, '2026-06-01');
		assert.equal(inMonth[0].day, 1);
		assert.equal(inMonth[29].key, '2026-06-30');
	});

	it('marks today only on the matching cell', () => {
		const todays = cells.filter((c) => c.isToday);
		assert.equal(todays.length, 1);
		assert.equal(todays[0].key, '2026-06-15');
	});

	it('lays cells out as consecutive days', () => {
		for (let i = 1; i < cells.length; i++) {
			const prev = new Date(`${cells[i - 1].key}T00:00:00Z`);
			const cur = new Date(`${cells[i].key}T00:00:00Z`);
			assert.equal((cur - prev) / 86400000, 1);
		}
	});

	it('starts the week on Monday', () => {
		// 2026-06-01 is a Monday, so it is the first cell with no leading days.
		assert.equal(cells[0].key, '2026-06-01');
	});
});

describe('groupByDay', () => {
	it('groups items by the key function', () => {
		const items = [
			{ id: 1, day: '2026-06-01' },
			{ id: 2, day: '2026-06-01' },
			{ id: 3, day: '2026-06-02' },
		];
		const grouped = groupByDay(items, (i) => i.day);
		assert.equal(grouped['2026-06-01'].length, 2);
		assert.equal(grouped['2026-06-02'].length, 1);
	});

	it('skips items with an empty key', () => {
		const grouped = groupByDay([{ id: 1, day: '' }], (i) => i.day);
		assert.deepEqual(grouped, {});
	});
});

describe('shiftMonth', () => {
	it('rolls over year boundaries', () => {
		assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
		assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
		assert.deepEqual(shiftMonth(2026, 5, 1), { year: 2026, month: 6 });
	});
});
