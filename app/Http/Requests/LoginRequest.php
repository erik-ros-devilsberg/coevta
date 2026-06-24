<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared credential validation for both the web (session) and API (token)
 * login endpoints. Field validation runs the same way for both; how a failure
 * is rendered (HTML redirect vs JSON 422) is handled by the framework based on
 * the request — see shouldRenderJsonWhen(api/*) in bootstrap/app.php.
 */
class LoginRequest extends FormRequest
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
			'password' => ['required', 'string'],
		];
	}
}
