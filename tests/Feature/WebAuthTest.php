<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class WebAuthTest extends TestCase
{
	use RefreshDatabase;

	protected function setUp(): void
	{
		parent::setUp();
		// The login routes are rate-limited via the cache; flush it between
		// tests so accumulated attempts don't bleed across test methods.
		Cache::flush();
	}

	// --- Landing ------------------------------------------------------------

	public function test_landing_page_is_public(): void
	{
		$this->get('/')->assertOk();
	}

	// --- Login screen -------------------------------------------------------

	public function test_login_form_is_shown_to_guests(): void
	{
		$this->get('/login')
			->assertOk()
			->assertSee('Log in');
	}

	public function test_authenticated_user_is_redirected_away_from_login(): void
	{
		$this->actingAs(User::factory()->create());

		$this->get('/login')->assertRedirect('/dashboard');
	}

	// --- Login attempt ------------------------------------------------------

	public function test_valid_credentials_authenticate_the_session(): void
	{
		$user = User::factory()->create(['password' => Hash::make('secret-pass')]);

		$response = $this->post('/login', [
			'email' => $user->email,
			'password' => 'secret-pass',
		]);

		$response->assertRedirect('/dashboard');
		$this->assertAuthenticatedAs($user);
	}

	public function test_invalid_credentials_do_not_authenticate(): void
	{
		$user = User::factory()->create(['password' => Hash::make('secret-pass')]);

		$response = $this->from('/login')->post('/login', [
			'email' => $user->email,
			'password' => 'wrong-pass',
		]);

		$response->assertRedirect('/login');
		$response->assertSessionHasErrors('email');
		$this->assertGuest();
	}

	public function test_login_requires_email_and_password(): void
	{
		$this->from('/login')->post('/login', [])
			->assertSessionHasErrors(['email', 'password']);

		$this->assertGuest();
	}

	// --- Dashboard (protected) ---------------------------------------------

	public function test_dashboard_requires_authentication(): void
	{
		$this->get('/dashboard')->assertRedirect('/login');
	}

	public function test_dashboard_is_accessible_when_authenticated(): void
	{
		$this->actingAs(User::factory()->create());

		$this->get('/dashboard')->assertOk();
	}

	// --- Logout -------------------------------------------------------------

	public function test_logout_ends_the_session(): void
	{
		$this->actingAs(User::factory()->create());

		$this->post('/logout')->assertRedirect('/');
		$this->assertGuest();

		// The protected page is no longer reachable afterwards.
		$this->get('/dashboard')->assertRedirect('/login');
	}

	public function test_logout_requires_authentication(): void
	{
		$this->post('/logout')->assertRedirect('/login');
	}

	// --- Throttling ---------------------------------------------------------

	public function test_web_login_is_rate_limited(): void
	{
		$user = User::factory()->create(['password' => Hash::make('secret-pass')]);

		// throttle:6,1 — six attempts allowed per minute, the seventh is blocked.
		for ($i = 0; $i < 6; $i++) {
			$this->from('/login')->post('/login', [
				'email' => $user->email,
				'password' => 'wrong-pass',
			]);
		}

		$this->from('/login')->post('/login', [
			'email' => $user->email,
			'password' => 'wrong-pass',
		])->assertStatus(429);
	}
}
