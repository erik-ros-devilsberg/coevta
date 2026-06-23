<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Tests\TestCase;

class ErrorEnvelopeTest extends TestCase
{
	public function test_unknown_api_route_returns_json_404_envelope(): void
	{
		$response = $this->getJson('/api/v1/does-not-exist');

		$response->assertNotFound();
		$response->assertHeader('Content-Type', 'application/json');
		$response->assertJsonStructure(['message']);
	}

	public function test_validation_failure_returns_json_422_envelope(): void
	{
		// Registered under the api/* path so the JSON error envelope applies.
		Route::middleware('api')->post('/api/v1/_test/validate', function () {
			throw ValidationException::withMessages(['name' => 'The name field is required.']);
		});

		$response = $this->postJson('/api/v1/_test/validate', []);

		$response->assertStatus(422);
		$response->assertJsonStructure(['message', 'errors' => ['name']]);
	}

	public function test_bad_request_returns_json_400_envelope(): void
	{
		Route::middleware('api')->get('/api/v1/_test/bad-request', function () {
			throw new BadRequestHttpException('Bad request.');
		});

		$response = $this->getJson('/api/v1/_test/bad-request');

		$response->assertStatus(400);
		$response->assertJsonStructure(['message']);
	}
}
