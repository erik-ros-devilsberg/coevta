<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ApiAuthTest extends TestCase
{
	use RefreshDatabase;

	protected function setUp(): void
	{
		parent::setUp();
		// Login is rate-limited via the cache; flush between tests for isolation.
		Cache::flush();
	}

	private function createUser(string $password = 'secret-pass'): User
	{
		return User::factory()->create(['password' => Hash::make($password)]);
	}

	// --- Login --------------------------------------------------------------

	public function test_login_returns_a_token_for_valid_credentials(): void
	{
		$user = $this->createUser();

		$response = $this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'secret-pass',
		]);

		$response->assertOk();
		$response->assertJsonStructure(['token']);
		$this->assertNotEmpty($response->json('token'));
	}

	public function test_issued_token_authenticates_subsequent_requests(): void
	{
		$user = $this->createUser();

		$token = $this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'secret-pass',
		])->json('token');

		$this->withToken($token)
			->getJson('/api/v1/user')
			->assertOk()
			->assertJsonPath('email', $user->email);
	}

	public function test_invalid_credentials_return_401_without_a_token(): void
	{
		$user = $this->createUser();

		$response = $this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'wrong-pass',
		]);

		$response->assertUnauthorized();
		$response->assertJsonMissingPath('token');
	}

	public function test_unknown_email_returns_401_without_a_token(): void
	{
		// No user exists for this email — same generic 401 as a wrong password,
		// so the response does not disclose whether the email is registered.
		$response = $this->postJson('/api/v1/login', [
			'email' => 'nobody@example.com',
			'password' => 'whatever',
		]);

		$response->assertUnauthorized();
		$response->assertJsonMissingPath('token');
	}

	public function test_login_requires_email_and_password(): void
	{
		$this->postJson('/api/v1/login', [])
			->assertStatus(422)
			->assertJsonValidationErrors(['email', 'password']);
	}

	// --- Logout -------------------------------------------------------------

	public function test_logout_revokes_the_current_token(): void
	{
		$user = $this->createUser();

		$token = $this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'secret-pass',
		])->json('token');

		$this->withToken($token)->postJson('/api/v1/logout')->assertNoContent();

		// The token row is gone — it has been revoked.
		$this->assertDatabaseCount('personal_access_tokens', 0);

		// Forget the guard resolved during the logout request so the next call
		// re-authenticates from scratch (the in-process guard caches the user
		// across requests within a single test; a real deployment would not).
		$this->app['auth']->forgetGuards();

		// The revoked token no longer authenticates.
		$this->withToken($token)->getJson('/api/v1/user')->assertUnauthorized();
	}

	public function test_logout_requires_authentication(): void
	{
		$this->postJson('/api/v1/logout')->assertUnauthorized();
	}

	// --- Throttling ---------------------------------------------------------

	public function test_login_is_rate_limited(): void
	{
		$user = $this->createUser();

		// throttle:6,1 — six attempts allowed per minute, the seventh is blocked.
		for ($i = 0; $i < 6; $i++) {
			$this->postJson('/api/v1/login', [
				'email' => $user->email,
				'password' => 'wrong-pass',
			]);
		}

		$this->postJson('/api/v1/login', [
			'email' => $user->email,
			'password' => 'wrong-pass',
		])->assertStatus(429);
	}
}
