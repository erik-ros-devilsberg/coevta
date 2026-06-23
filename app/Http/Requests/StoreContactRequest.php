<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreContactRequest extends FormRequest
{
	public function authorize(): bool
	{
		// Route is already gated by auth:sanctum; any authenticated user may create.
		return true;
	}

	/**
	 * @return array<string, ValidationRule|array<mixed>|string>
	 */
	public function rules(): array
	{
		return [
			'display_name' => ['required', 'string', 'max:255'],
			'given_name' => ['nullable', 'string', 'max:255'],
			'family_name' => ['nullable', 'string', 'max:255'],
			'email' => ['nullable', 'email', 'max:255'],
			'phone' => ['nullable', 'string', 'max:255'],
			'organization' => ['nullable', 'string', 'max:255'],
			'notes' => ['nullable', 'string'],
			'address' => ['nullable', 'string', 'max:255'],
			'birthday' => ['nullable', 'date'],
		];
	}
}
