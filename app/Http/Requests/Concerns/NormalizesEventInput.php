<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Support\Carbon;

/**
 * Applies the Events "minimize computer says no" defaults before validation.
 *
 * Whatever the client sends is normalized into a complete, sensible event so
 * validation never has to reject it:
 *  - title    → "Untitled event" when blank/missing
 *  - start_at → parsed (tz-less assumed UTC, offsets converted); now() on failure
 *  - end_at   → start_at + 1h when missing or before start; kept when == start
 *  - all_day  → coerced to bool; when true, snaps to whole-day bounds
 */
trait NormalizesEventInput
{
	protected function prepareForValidation(): void
	{
		$allDay = filter_var($this->input('all_day', false), FILTER_VALIDATE_BOOLEAN);

		$start = $this->parseUtcOrNull($this->input('start_at')) ?? Carbon::now('UTC');
		$end = $this->parseUtcOrNull($this->input('end_at'));

		if ($allDay) {
			$start = $start->startOfDay();
			// End date is the provided end (if not before start), else the start date.
			$endBase = ($end !== null && $end->greaterThanOrEqualTo($start)) ? $end : $start;
			$end = $endBase->copy()->setTime(23, 59, 59);
		} elseif ($end === null || $end->lessThan($start)) {
			$end = $start->copy()->addHour();
		}

		$title = $this->input('title');

		$this->merge([
			'title' => is_string($title) && trim($title) !== '' ? $title : 'Untitled event',
			'start_at' => $start->toIso8601ZuluString('microsecond'),
			'end_at' => $end->toIso8601ZuluString('microsecond'),
			'all_day' => $allDay,
		]);
	}

	private function parseUtcOrNull(mixed $value): ?Carbon
	{
		if (! is_string($value) || trim($value) === '') {
			return null;
		}

		try {
			// tz-less strings are read as UTC; strings with an offset convert to UTC.
			return Carbon::parse($value, 'UTC')->setTimezone('UTC');
		} catch (\Throwable) {
			return null;
		}
	}
}
