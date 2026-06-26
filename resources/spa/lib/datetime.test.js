import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isDateOnly, toLocalInput, fromLocalInput, formatDueForDisplay } from './datetime.js';

describe('isDateOnly', () => {
	it('recognises date-only values and rejects datetimes/null', () => {
		assert.equal(isDateOnly('2026-06-25'), true);
		assert.equal(isDateOnly('2026-06-25T12:00:00.000000Z'), false);
		assert.equal(isDateOnly(null), false);
		assert.equal(isDateOnly(''), false);
	});
});

describe('toLocalInput', () => {
	it('passes date-only values through unchanged', () => {
		assert.equal(toLocalInput('2026-06-25'), '2026-06-25');
	});

	it('returns empty string for null', () => {
		assert.equal(toLocalInput(null), '');
	});
});

describe('fromLocalInput', () => {
	it('keeps date-only granularity', () => {
		assert.equal(fromLocalInput('2026-06-25', { dateOnly: true }), '2026-06-25');
		assert.equal(fromLocalInput('2026-06-25'), '2026-06-25');
	});

	it('converts a local datetime input to ISO 8601 UTC', () => {
		const iso = fromLocalInput('2026-06-25T14:30');
		assert.match(iso, /Z$/);
	});

	it('returns null for empty input', () => {
		assert.equal(fromLocalInput(''), null);
	});

	it('round-trips local datetime through UTC regardless of timezone', () => {
		// local -> UTC -> local must return the original local input.
		const local = '2026-06-25T14:30';
		assert.equal(toLocalInput(fromLocalInput(local)), local);
	});
});

describe('formatDueForDisplay', () => {
	it('shows date-only as-is and empty for null', () => {
		assert.equal(formatDueForDisplay('2026-06-25'), '2026-06-25');
		assert.equal(formatDueForDisplay(null), '');
	});
});
