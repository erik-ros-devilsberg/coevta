<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateApiTokenCommandTest extends TestCase
{
	use RefreshDatabase;

	public function test_creates_user_and_issues_token(): void
	{
		$this->artisan('coevta:create-token', ['email' => 'dev@example.com'])
			->assertExitCode(0);

		$user = User::where('email', 'dev@example.com')->first();

		$this->assertNotNull($user);
		$this->assertSame(1, $user->tokens()->count());
	}

	public function test_reuses_existing_user(): void
	{
		$user = User::factory()->create(['email' => 'existing@example.com']);

		$this->artisan('coevta:create-token', ['email' => 'existing@example.com'])
			->assertExitCode(0);

		$this->assertSame(1, User::where('email', 'existing@example.com')->count());
		$this->assertSame(1, $user->fresh()->tokens()->count());
	}
}
