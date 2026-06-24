<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

/**
 * API (token) authentication. Validates credentials and issues a Sanctum
 * personal access token — the same token model used by the
 * coevta:create-token command.
 */
class ApiLoginController extends Controller
{
	/**
	 * A valid bcrypt hash (cost 12, the app default) used only to equalize
	 * response time when the email is unknown — see login(). It is not a real
	 * credential; nothing hashes to a usable password here.
	 */
	private const TIMING_EQUALIZER_HASH = '$2y$12$bZF9JepL.LmvzJ07lb25weLmhkRHR649rlraLkOt5x8.UdXBp/hc.';

	public function login(LoginRequest $request): JsonResponse
	{
		$user = User::query()
			->where('email', (string) $request->string('email'))
			->first();

		// Always run a hash comparison, even when the user is unknown, so the
		// response time does not reveal whether the email is registered
		// (prevents timing-based user enumeration). When there is no user we
		// compare against a fixed valid hash so the work is equivalent.
		$passwordMatches = Hash::check(
			(string) $request->string('password'),
			$user?->getAuthPassword() ?? self::TIMING_EQUALIZER_HASH,
		);

		// Generic failure — do not disclose whether the email is registered.
		if ($user === null || ! $passwordMatches) {
			return response()->json([
				'message' => 'These credentials do not match our records.',
			], Response::HTTP_UNAUTHORIZED);
		}

		$token = $user->createToken('api')->plainTextToken;

		return response()->json(['token' => $token]);
	}

	public function logout(Request $request): Response
	{
		/** @var User $user */
		$user = $request->user();

		// Revoke only the token used for this request.
		$user->currentAccessToken()->delete();

		return response()->noContent();
	}
}
