<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\NormalizesEventInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreEventRequest extends FormRequest
{
	use NormalizesEventInput;

	public function authorize(): bool
	{
		// Route is gated by auth:sanctum; any authenticated user may create.
		return true;
	}

	/**
	 * Inputs are normalized in prepareForValidation(), so by the time these
	 * rules run every value is already present and well-formed — the request
	 * effectively never fails on the event fields.
	 *
	 * @return array<string, ValidationRule|array<mixed>|string>
	 */
	public function rules(): array
	{
		return [
			'title' => ['required', 'string', 'max:255'],
			'description' => ['nullable', 'string'],
			'location' => ['nullable', 'string', 'max:255'],
			'start_at' => ['required', 'date'],
			'end_at' => ['required', 'date', 'after_or_equal:start_at'],
			'all_day' => ['required', 'boolean'],
		];
	}
}
