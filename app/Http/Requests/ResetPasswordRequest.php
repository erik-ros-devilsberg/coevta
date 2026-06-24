<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for applying a password reset. The token + email pairing is
 * verified by the password broker; this request only ensures the fields are
 * present and the new password meets the minimum policy (min 8, confirmed).
 */
class ResetPasswordRequest extends FormRequest
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
			'token' => ['required', 'string'],
			'email' => ['required', 'email'],
			'password' => ['required', 'string', 'min:8', 'confirmed'],
		];
	}
}
