<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\NormalizesTaskInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskRequest extends FormRequest
{
	use NormalizesTaskInput;

	public function authorize(): bool
	{
		return true;
	}

	/**
	 * PUT is a full replacement; the same forgiving normalization and rules as
	 * create apply (see NormalizesTaskInput). Omitting completed_at reopens the task.
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
