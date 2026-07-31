// Datetime helpers shared by the Tasks and Calendar modules. The API carries
// dates either as date-only (YYYY-MM-DD) or as ISO 8601 UTC datetimes. We always
// store/transport UTC and only convert to local time for display / form inputs.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value) {
	return typeof value === 'string' && DATE_ONLY.test(value);
}

function pad(n) {
	return String(n).padStart(2, '0');
}

/**
 * API value → value for an <input>. Date-only passes through (for `type=date`);
 * a UTC datetime becomes `YYYY-MM-DDTHH:mm` in the user's local time (for
 * `type=datetime-local`).
 */
export function toLocalInput(value) {
	if (!value) {
		return '';
	}
	if (isDateOnly(value)) {
		return value;
	}

	const d = new Date(value);
	if (Number.isNaN(d.getTime())) {
		return '';
	}

	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * <input> value → value to send to the API. Date-only stays date-only; a
 * local `datetime-local` value is converted to ISO 8601 UTC (trailing `Z`).
 */
export function fromLocalInput(value, { dateOnly = false } = {}) {
	if (!value) {
		return null;
	}
	if (dateOnly || isDateOnly(value)) {
		return value.slice(0, 10);
	}

	const d = new Date(value); // a value without an offset is parsed as local time
	if (Number.isNaN(d.getTime())) {
		return null;
	}

	return d.toISOString();
}

/**
 * The local calendar day (`YYYY-MM-DD`) an API value falls on — date-only values
 * pass through; datetimes (string or Date) are resolved in the user's local time.
 * Used to drop events onto calendar cells.
 */
export function localDateKey(value) {
	if (!value) {
		return '';
	}
	if (isDateOnly(value)) {
		return value;
	}

	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) {
		return '';
	}

	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Human-readable display: date-only as-is, datetimes in local time. */
export function formatDueForDisplay(value) {
	if (!value) {
		return '';
	}
	if (isDateOnly(value)) {
		return value;
	}

	const d = new Date(value);
	if (Number.isNaN(d.getTime())) {
		return '';
	}

	return d.toLocaleString();
}
