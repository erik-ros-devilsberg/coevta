// Pure month-grid helpers for the calendar. All arithmetic is done in UTC so the
// computed grid (calendar labels) is deterministic regardless of the runtime
// timezone — mapping events onto days is the caller's job (via datetime.localDateKey).

function pad(n) {
	return String(n).padStart(2, '0');
}

export function daysInMonth(year, month0) {
	return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Build a month grid as an array of weeks (Monday-first), each a length-7 array
 * of cells `{ key: 'YYYY-MM-DD', day, inMonth, isToday }`. Leading/trailing cells
 * spill into the adjacent months. `todayKey` (a 'YYYY-MM-DD' string) marks today.
 */
export function monthMatrix(year, month0, todayKey = null) {
	const dim = daysInMonth(year, month0);
	const first = new Date(Date.UTC(year, month0, 1));
	const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
	const totalCells = Math.ceil((lead + dim) / 7) * 7;

	const weeks = [];
	let cursor = new Date(Date.UTC(year, month0, 1 - lead));

	for (let i = 0; i < totalCells; i++) {
		const y = cursor.getUTCFullYear();
		const m = cursor.getUTCMonth();
		const d = cursor.getUTCDate();
		const key = `${y}-${pad(m + 1)}-${pad(d)}`;

		if (i % 7 === 0) {
			weeks.push([]);
		}
		weeks[weeks.length - 1].push({
			key,
			day: d,
			inMonth: m === month0,
			isToday: todayKey === key,
		});

		cursor = new Date(Date.UTC(y, m, d + 1));
	}

	return weeks;
}

/** Group items into `{ [dayKey]: items[] }` using a key function; empty keys skipped. */
export function groupByDay(items, keyFn) {
	const map = {};
	for (const item of items) {
		const key = keyFn(item);
		if (!key) {
			continue;
		}
		(map[key] ??= []).push(item);
	}
	return map;
}

/** Shift a (year, month0) by a number of months, rolling over year boundaries. */
export function shiftMonth(year, month0, delta) {
	const d = new Date(Date.UTC(year, month0 + delta, 1));
	return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}
