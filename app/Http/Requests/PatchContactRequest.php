<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\MergesPatchIntoStoredRecord;
use App\Http\Resources\ContactResource;
use App\Models\Contact;
use App\Models\User;

/**
 * PATCH is a partial update: only the fields in the body change. The stored
 * contact supplies everything else, so the inherited PUT rules still run
 * against a complete record — display_name included.
 */
class PatchContactRequest extends UpdateContactRequest
{
	use MergesPatchIntoStoredRecord;

	protected function prepareForValidation(): void
	{
		$contact = $this->storedContact();

		if ($contact !== null) {
			$this->mergePatchOver(ContactResource::make($contact));
		}

		parent::prepareForValidation();
		$this->keepUnreadableDatesForValidation(['birthday']);
	}

	/**
	 * The contact being patched, scoped to its owner — a record belonging to
	 * someone else is simply not found, as everywhere else in the API.
	 */
	private function storedContact(): ?Contact
	{
		/** @var User $user */
		$user = $this->user();
		$id = $this->route('contact');

		return is_string($id) ? $user->contacts()->find($id) : null;
	}
}
