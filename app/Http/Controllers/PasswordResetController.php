<?php

namespace App\Http\Controllers;

use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

/**
 * API password recovery. Wraps Laravel's Password broker (which uses the
 * password_reset_tokens table) behind two JSON endpoints. The browser flow is
 * a client-side concern — the reset link points at the SPA, which posts the
 * token back to reset().
 */
class PasswordResetController extends Controller
{
	/**
	 * Send a reset link for the given email. Always returns the same response
	 * whether or not the address is registered, so it cannot be used to probe
	 * which emails exist (no account enumeration).
	 */
	public function sendResetLink(ForgotPasswordRequest $request): JsonResponse
	{
		Password::sendResetLink($request->only('email'));

		return response()->json([
			'message' => 'If that email address is registered, a reset link has been sent.',
		]);
	}

	/**
	 * Apply a new password given a valid token. On success the password is
	 * rehashed and every existing Sanctum token for the user is revoked, so a
	 * leaked password cannot keep live API sessions alive.
	 */
	public function reset(ResetPasswordRequest $request): JsonResponse
	{
		$status = Password::reset(
			$request->only('email', 'password', 'password_confirmation', 'token'),
			function (User $user, string $password): void {
				$user->forceFill([
					'password' => Hash::make($password),
				])->save();

				// Revoke all of the user's API tokens after a reset.
				$user->tokens()->delete();

				event(new PasswordReset($user));
			},
		);

		if ($status !== Password::PASSWORD_RESET) {
			// Invalid/expired token or unknown email — a genuine "cannot
			// interpret" case, so a 422 is appropriate here.
			throw ValidationException::withMessages([
				'email' => ['This password reset token is invalid or has expired.'],
			]);
		}

		return response()->json([
			'message' => 'Your password has been reset.',
		]);
	}
}
