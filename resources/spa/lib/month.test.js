import { describe, it, expect } from 'vitest';

import { daysInMonth, monthMatrix, groupByDay, shiftMonth } from './month.js';

describe('daysInMonth', () => {
	it('counts days, including leap February', () => {
		expect(daysInMonth(2026, 5)).toBe(30); // June
		expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026 (non-leap)
		expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)
	});
});

describe('monthMatrix', () => {
	const weeks = monthMatrix(2026, 5, '2026-06-15'); // June 2026
	const cells = weeks.flat();

	it('returns full weeks of seven days', () => {
		for (const week of weeks) {
			expect(week.length).toBe(7);
		}
		expect(cells.length % 7).toBe(0);
	});

	it('contains exactly the days of the month as in-month cells', () => {
		const inMonth = cells.filter((c) => c.inMonth);
		expect(inMonth.length).toBe(30);
		expect(inMonth[0].key).toBe('2026-06-01');
		expect(inMonth[0].day).toBe(1);
		expect(inMonth[29].key).toBe('2026-06-30');
	});

	it('marks today only on the matching cell', () => {
		const todays = cells.filter((c) => c.isToday);
		expect(todays.length).toBe(1);
		expect(todays[0].key).toBe('2026-06-15');
	});

	it('lays cells out as consecutive days', () => {
		for (let i = 1; i < cells.length; i++) {
			const prev = new Date(`${cells[i - 1].key}T00:00:00Z`);
			const cur = new Date(`${cells[i].key}T00:00:00Z`);
			expect((cur - prev) / 86400000).toBe(1);
		}
	});

	it('starts the week on Monday', () => {
		// 2026-06-01 is a Monday, so it is the first cell with no leading days.
		expect(cells[0].key).toBe('2026-06-01');
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
		expect(grouped['2026-06-01'].length).toBe(2);
		expect(grouped['2026-06-02'].length).toBe(1);
	});

	it('skips items with an empty key', () => {
		const grouped = groupByDay([{ id: 1, day: '' }], (i) => i.day);
		expect(grouped).toEqual({});
	});
});

describe('shiftMonth', () => {
	it('rolls over year boundaries', () => {
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
	});
});
