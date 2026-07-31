import { describe, it, expect } from 'vitest';

import { daysInMonth, monthMatrix, groupByDay, shiftMonth, dayKeyFor } from './month.js';

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

describe('dayKeyFor', () => {
	it('places a timed event on its local day', () => {
		// A timed event happens at an instant, so it belongs on whichever day that
		// instant falls on for the person looking at the grid.
		const key = dayKeyFor({ all_day: false, start_at: '2026-08-01T12:00:00.000Z' });

		expect(key).toBe(localDayOf('2026-08-01T12:00:00.000Z'));
	});

	it('places an all-day event on its calendar date, regardless of timezone', () => {
		// An all-day event on 1 August is 1 August everywhere. Resolving it in
		// local time would drag it onto 31 July for anyone west of UTC, because
		// the API stores it as midnight UTC.
		expect(dayKeyFor({ all_day: true, start_at: '2026-08-01T00:00:00.000Z' })).toBe('2026-08-01');
	});

	it('treats a date-only all-day value the same as the server\'s midnight-UTC one', () => {
		// This is what stops an event created offline jumping to another cell when
		// the server's version replaces it: both forms resolve to one key.
		const local = dayKeyFor({ all_day: true, start_at: '2026-08-01' });
		const fromServer = dayKeyFor({ all_day: true, start_at: '2026-08-01T00:00:00.000Z' });

		expect(local).toBe('2026-08-01');
		expect(fromServer).toBe(local);
	});

	it('returns an empty key for an event with no start, so grouping skips it', () => {
		expect(dayKeyFor({ all_day: false, start_at: null })).toBe('');
	});
});

// The local day an instant falls on, computed independently of the helper under
// test so the assertion holds in whatever timezone the suite runs in.
function localDayOf(iso) {
	const d = new Date(iso);
	const pad = (n) => String(n).padStart(2, '0');

	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('shiftMonth', () => {
	it('rolls over year boundaries', () => {
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
	});
});
