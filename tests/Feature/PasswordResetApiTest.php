<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetApiTest extends TestCase
{
	use RefreshDatabase;

	protected function setUp(): void
	{
		parent::setUp();
		// The reset endpoints are rate-limited via the cache; flush between
		// tests so accumulated attempts don't bleed across test methods.
		Cache::flush();
	}

	private function createUser(string $password = 'old-password'): User
	{
		return User::factory()->create(['password' => Hash::make($password)]);
	}

	// --- Forgot password (request a link) -----------------------------------

	public function test_forgot_password_sends_a_reset_notification_for_a_known_email(): void
	{
		Notification::fake();
		$user = $this->createUser();

		$this->postJson('/api/v1/forgot-password', ['email' => $user->email])
			->assertOk();

		Notification::assertSentTo($user, ResetPassword::class);
	}

	public function test_forgot_password_for_an_unknown_email_returns_the_same_response_and_sends_nothing(): void
	{
		Notification::fake();
		$user = $this->createUser();

		$known = $this->postJson('/api/v1/forgot-password', ['email' => $user->email]);
		$unknown = $this->postJson('/api/v1/forgot-password', ['email' => 'nobody@example.com']);

		// Indistinguishable responses — no account enumeration.
		$unknown->assertStatus($known->getStatusCode());
		$this->assertSame($known->json(), $unknown->json());

		// No notification was sent for the address that does not exist.
		Notification::assertNotSentTo(
			new \Illuminate\Notifications\AnonymousNotifiable(),
			ResetPassword::class,
		);
		Notification::assertSentToTimes($user, ResetPassword::class, 1);
	}

	public function test_reset_link_points_at_the_configured_frontend_url(): void
	{
		config(['app.frontend_url' => 'https://app.example.test']);
		Notification::fake();
		$user = $this->createUser();

		$this->postJson('/api/v1/forgot-password', ['email' => $user->email])->assertOk();

		Notification::assertSentTo(
			$user,
			ResetPassword::class,
			function (ResetPassword $notification) use ($user): bool {
				// Building the mail runs the createUrlUsing callback — the link
				// must target the SPA reset route carrying token + email.
				$url = $notification->toMail($user)->actionUrl ?? '';

				return str_starts_with($url, 'https://app.example.test/reset-password?token=')
					&& str_contains($url, 'email='.urlencode($user->email));
			},
		);
	}

	public function test_forgot_password_requires_an_email(): void
	{
		$this->postJson('/api/v1/forgot-password', [])
			->assertStatus(422)
			->assertJsonValidationErrors(['email']);
	}

	// --- Reset password -----------------------------------------------------

	public function test_a_valid_token_resets_the_password_and_allows_login(): void
	{
		$user = $this->createUser();
		$token = Password::createToken($user);

		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => $token,
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		])->assertOk();

		// The new password works...
		$this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'brand-new-password',
		])->assertOk()->assertJsonStructure(['token']);

		// ...and the old one no longer does.
		$this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'old-password',
		])->assertUnauthorized();
	}

	public function test_an_expired_token_is_rejected_and_leaves_the_password_unchanged(): void
	{
		$user = $this->createUser();
		$token = Password::createToken($user);

		// Tokens expire after 60 minutes (config/auth.php passwords.users.expire).
		$this->travel(61)->minutes();

		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => $token,
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		])->assertStatus(422);

		$this->assertTrue(Hash::check('old-password', $user->fresh()->password));
	}

	public function test_a_used_token_cannot_be_reused(): void
	{
		$user = $this->createUser();
		$token = Password::createToken($user);

		$payload = [
			'email' => $user->email,
			'token' => $token,
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		];

		$this->postJson('/api/v1/reset-password', $payload)->assertOk();
		// Second attempt with the same (now consumed) token fails.
		$this->postJson('/api/v1/reset-password', $payload)->assertStatus(422);
	}

	public function test_an_invalid_token_is_rejected(): void
	{
		$user = $this->createUser();

		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => 'totally-made-up-token',
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		])->assertStatus(422);

		$this->assertTrue(Hash::check('old-password', $user->fresh()->password));
	}

	public function test_a_token_for_a_different_email_is_rejected(): void
	{
		$user = $this->createUser();
		$other = $this->createUser();
		$token = Password::createToken($other);

		// Valid token, but paired with the wrong email.
		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => $token,
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		])->assertStatus(422);

		$this->assertTrue(Hash::check('old-password', $user->fresh()->password));
	}

	public function test_reset_enforces_minimum_length_and_confirmation(): void
	{
		$user = $this->createUser();
		$token = Password::createToken($user);

		// Too short.
		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => $token,
			'password' => 'short',
			'password_confirmation' => 'short',
		])->assertStatus(422)->assertJsonValidationErrors(['password']);

		// Mismatched confirmation.
		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => $token,
			'password' => 'brand-new-password',
			'password_confirmation' => 'different-password',
		])->assertStatus(422)->assertJsonValidationErrors(['password']);
	}

	public function test_reset_revokes_existing_sanctum_tokens(): void
	{
		$user = $this->createUser();
		$apiToken = $user->createToken('api')->plainTextToken;
		$resetToken = Password::createToken($user);

		// The token works before the reset.
		$this->withToken($apiToken)->getJson('/api/v1/user')->assertOk();

		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => $resetToken,
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		])->assertOk();

		$this->assertDatabaseCount('personal_access_tokens', 0);

		// Re-resolve guards so the in-process Sanctum guard doesn't cache the user.
		$this->app['auth']->forgetGuards();

		$this->withToken($apiToken)->getJson('/api/v1/user')->assertUnauthorized();
	}

	// --- Throttling ---------------------------------------------------------

	public function test_forgot_password_is_rate_limited(): void
	{
		$user = $this->createUser();

		// throttle:6,1 — six attempts per minute, the seventh is blocked.
		for ($i = 0; $i < 6; $i++) {
			$this->postJson('/api/v1/forgot-password', ['email' => $user->email]);
		}

		$this->postJson('/api/v1/forgot-password', ['email' => $user->email])
			->assertStatus(429);
	}

	public function test_reset_password_is_rate_limited(): void
	{
		$user = $this->createUser();

		for ($i = 0; $i < 6; $i++) {
			$this->postJson('/api/v1/reset-password', [
				'email' => $user->email,
				'token' => 'bad-token',
				'password' => 'brand-new-password',
				'password_confirmation' => 'brand-new-password',
			]);
		}

		$this->postJson('/api/v1/reset-password', [
			'email' => $user->email,
			'token' => 'bad-token',
			'password' => 'brand-new-password',
			'password_confirmation' => 'brand-new-password',
		])->assertStatus(429);
	}
}
