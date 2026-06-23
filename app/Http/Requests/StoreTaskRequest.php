<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\NormalizesTaskInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreTaskRequest extends FormRequest
{
	use NormalizesTaskInput;

	public function authorize(): bool
	{
		// Route is gated by auth:sanctum; any authenticated user may create.
		return true;
	}

	/**
	 * Inputs are normalized in prepareForValidation(), so these rules run
	 * against resolved values and effectively never fail.
	 *
	 * @return array<string, ValidationRule|array<mixed>|string>
	 */
	public function rules(): array
	{
		return [
			'title' => ['required', 'string', 'max:255'],
			'notes' => ['nullable', 'string'],
			'due_at' => ['nullable', 'date'],
			'due_has_time' => ['required', 'boolean'],
			'completed_at' => ['nullable', 'date'],
		];
	}
}
