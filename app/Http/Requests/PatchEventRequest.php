<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\MergesPatchIntoStoredRecord;
use App\Http\Resources\EventResource;
use App\Models\Event;
use App\Models\User;

/**
 * PATCH is a partial update: only the fields in the body change. Because the
 * patch is merged onto the stored event first, the inherited normalization
 * still sees a whole event — so patching start_at past the stored end_at moves
 * the end, and patching all_day snaps the stored bounds.
 */
class PatchEventRequest extends UpdateEventRequest
{
	use MergesPatchIntoStoredRecord;

	protected function prepareForValidation(): void
	{
		$event = $this->storedEvent();

		if ($event !== null) {
			$this->mergePatchOver(EventResource::make($event));
		}

		parent::prepareForValidation();
		$this->keepUnreadableDatesForValidation(['start_at', 'end_at']);
	}

	/**
	 * The event being patched, scoped to its owner.
	 */
	private function storedEvent(): ?Event
	{
		/** @var User $user */
		$user = $this->user();
		$id = $this->route('event');

		return is_string($id) ? $user->events()->find($id) : null;
	}
}
