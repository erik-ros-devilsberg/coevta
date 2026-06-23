<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Support\Carbon;

/**
 * Applies the Tasks "minimize computer says no" defaults before validation.
 *
 *  - title        → "Untitled task" when blank/missing
 *  - due_at       → accepts date-only OR datetime; tz-less assumed UTC, offsets
 *                   converted; unparseable → null. The granularity is captured
 *                   in due_has_time so it can be echoed back faithfully.
 *  - completed_at → datetime in UTC (tz-less assumed UTC); unparseable → null
 */
trait NormalizesTaskInput
{
	protected function prepareForValidation(): void
	{
		$title = $this->input('title');
		[$dueAt, $dueHasTime] = $this->normalizeDue($this->input('due_at'));

		$this->merge([
			'title' => is_string($title) && trim($title) !== '' ? $title : 'Untitled task',
			'due_at' => $dueAt,
			'due_has_time' => $dueHasTime,
			'completed_at' => $this->parseUtcOrNull($this->input('completed_at'))?->toIso8601ZuluString('microsecond'),
		]);
	}

	/**
	 * @return array{0: ?string, 1: bool} the normalized ISO datetime (or null) and whether it has a time component
	 */
	private function normalizeDue(mixed $value): array
	{
		$parsed = $this->parseUtcOrNull($value);

		if ($parsed === null) {
			return [null, false];
		}

		// Date-only when the raw input was exactly YYYY-MM-DD.
		$hasTime = ! (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($value)) === 1);

		return [$parsed->toIso8601ZuluString('microsecond'), $hasTime];
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
