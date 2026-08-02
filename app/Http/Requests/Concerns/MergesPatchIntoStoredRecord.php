<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * Turns a PATCH body into the complete payload the PUT rules expect.
 *
 * A patch carries only the fields the client wants to change, but the update
 * rules — and the normalization in front of them — are written against a whole
 * record. So we take the stored record in exactly the shape the API hands out,
 * lay the patch over the top, and let the inherited rules run against the
 * result. A field the client did not send keeps its stored value; a field sent
 * as null is cleared.
 */
trait MergesPatchIntoStoredRecord
{
	/**
	 * The body as the client sent it — the record of which fields they actually
	 * meant to change. Stays null when there is no stored record to patch.
	 *
	 * @var array<array-key, mixed>|null
	 */
	private ?array $patchBody = null;

	/**
	 * Whether the record being patched exists and belongs to the caller.
	 */
	private bool $storedRecordFound = false;

	/**
	 * Rules only make sense against a record that exists. When it does not, skip
	 * them, so the controller's findOrFail answers with a 404 instead of
	 * validation answering with a misleading 422.
	 *
	 * @return array<string, ValidationRule|array<mixed>|string>
	 */
	public function rules(): array
	{
		return $this->storedRecordFound ? parent::rules() : [];
	}

	/**
	 * Lay the request body over the stored record's own JSON shape.
	 */
	protected function mergePatchOver(JsonResource $stored): void
	{
		$this->patchBody = $this->all();
		$this->storedRecordFound = true;

		// Encoding and decoding puts the stored record through the same
		// conversion the client saw when it read the record: Carbon instances
		// become ISO strings, which is what the normalization understands. Skip
		// this and dates arrive as objects, parse as null, and quietly reset.
		$encoded = json_encode($stored->toArray($this));
		$decoded = is_string($encoded) ? json_decode($encoded, true) : null;
		$base = is_array($decoded) ? $decoded : [];
		unset($base['id']);

		$this->replace(array_merge($base, $this->patchBody));
	}

	/**
	 * Put back any date the client sent that we could not read.
	 *
	 * Normalization turns an unreadable date into null — or, for an event's
	 * start, into "now". That is right for PUT, where the client sends the whole
	 * record, and wrong for PATCH, where a typo would wipe or move a value the
	 * client never meant to touch. Restoring the raw string lets the inherited
	 * `date` rule reject it, so the client gets a 422 naming the field.
	 *
	 * @param list<string> $keys
	 */
	protected function keepUnreadableDatesForValidation(array $keys): void
	{
		foreach ($keys as $key) {
			$value = $this->patchBody[$key] ?? null;

			// null and "" are empty rather than unreadable — those clear the
			// field, exactly as they do on PUT.
			if (is_string($value) && trim($value) !== '' && ! $this->isReadableDate($value)) {
				$this->merge([$key => $value]);
			}
		}
	}

	private function isReadableDate(string $value): bool
	{
		try {
			Carbon::parse($value, 'UTC');

			return true;
		} catch (\Throwable) {
			return false;
		}
	}
}
