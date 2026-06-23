<?php

namespace App\Http\Resources;

use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Contact
 */
class ContactResource extends JsonResource
{
	/**
	 * @return array<string, mixed>
	 */
	public function toArray(Request $request): array
	{
		return [
			'id' => $this->id,
			'display_name' => $this->display_name,
			'given_name' => $this->given_name,
			'family_name' => $this->family_name,
			'email' => $this->email,
			'phone' => $this->phone,
			'organization' => $this->organization,
			'notes' => $this->notes,
			'address' => $this->address,
			// Date-only (YYYY-MM-DD), matching Google's birthday date shape.
			'birthday' => $this->birthday?->format('Y-m-d'),
		];
	}
}
