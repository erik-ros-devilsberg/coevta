import { describe, it, expect } from 'vitest';

import { isDateOnly, toLocalInput, fromLocalInput, formatDueForDisplay, localDateKey } from './datetime.js';

describe('isDateOnly', () => {
	it('recognises date-only values and rejects datetimes/null', () => {
		expect(isDateOnly('2026-06-25')).toBe(true);
		expect(isDateOnly('2026-06-25T12:00:00.000000Z')).toBe(false);
		expect(isDateOnly(null)).toBe(false);
		expect(isDateOnly('')).toBe(false);
	});
});

describe('toLocalInput', () => {
	it('passes date-only values through unchanged', () => {
		expect(toLocalInput('2026-06-25')).toBe('2026-06-25');
	});

	it('returns empty string for null', () => {
		expect(toLocalInput(null)).toBe('');
	});
});

describe('fromLocalInput', () => {
	it('keeps date-only granularity', () => {
		expect(fromLocalInput('2026-06-25', { dateOnly: true })).toBe('2026-06-25');
		expect(fromLocalInput('2026-06-25')).toBe('2026-06-25');
	});

	it('converts a local datetime input to ISO 8601 UTC', () => {
		expect(fromLocalInput('2026-06-25T14:30')).toMatch(/Z$/);
	});

	it('returns null for empty input', () => {
		expect(fromLocalInput('')).toBe(null);
	});

	it('round-trips local datetime through UTC regardless of timezone', () => {
		const local = '2026-06-25T14:30';
		expect(toLocalInput(fromLocalInput(local))).toBe(local);
	});
});

describe('formatDueForDisplay', () => {
	it('shows date-only as-is and empty for null', () => {
		expect(formatDueForDisplay('2026-06-25')).toBe('2026-06-25');
		expect(formatDueForDisplay(null)).toBe('');
	});
});

describe('localDateKey', () => {
	it('returns the date part for date-only and empty for null', () => {
		expect(localDateKey('2026-06-25')).toBe('2026-06-25');
		expect(localDateKey(null)).toBe('');
	});

	it('derives the local day key from a Date (midday avoids tz date-flips)', () => {
		expect(localDateKey(new Date(2026, 5, 25, 12, 0))).toBe('2026-06-25');
	});
});
