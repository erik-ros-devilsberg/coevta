<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\NormalizesEventInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateEventRequest extends FormRequest
{
	use NormalizesEventInput;

	public function authorize(): bool
	{
		return true;
	}

	/**
	 * PUT is a full replacement; the same forgiving normalization and rules as
	 * create apply (see NormalizesEventInput).
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
