<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for requesting a password-reset link. Only the email is needed;
 * the response is intentionally the same whether or not the address exists, so
 * validation here is limited to "is this a syntactically valid email".
 */
class ForgotPasswordRequest extends FormRequest
{
	public function authorize(): bool
	{
		return true;
	}

	/**
	 * @return array<string, ValidationRule|array<mixed>|string>
	 */
	public function rules(): array
	{
		return [
			'email' => ['required', 'email'],
		];
	}
}
