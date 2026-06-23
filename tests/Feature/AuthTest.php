<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
	use RefreshDatabase;

	public function test_protected_route_rejects_unauthenticated_request_with_401(): void
	{
		$response = $this->getJson('/api/v1/user');

		$response->assertUnauthorized();
		$response->assertJsonStructure(['message']);
	}

	public function test_protected_route_accepts_valid_sanctum_token(): void
	{
		$user = User::factory()->create();
		$token = $user->createToken('test-token')->plainTextToken;

		$response = $this->withHeader('Authorization', "Bearer {$token}")
			->getJson('/api/v1/user');

		$response->assertOk();
		$response->assertJson(['id' => $user->id, 'email' => $user->email]);
	}
}
