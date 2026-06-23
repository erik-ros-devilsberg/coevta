<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthCheckTest extends TestCase
{
	public function test_ping_returns_ok_json_without_authentication(): void
	{
		$response = $this->getJson('/api/v1/ping');

		$response->assertOk();
		$response->assertJson(['status' => 'ok']);
		$response->assertJsonStructure(['status', 'time']);
	}

	public function test_ping_time_is_iso8601_utc(): void
	{
		$time = $this->getJson('/api/v1/ping')->json('time');

		// ISO 8601 UTC ends in Z (e.g. 2026-06-23T12:00:00.000000Z).
		$this->assertNotNull($time);
		$this->assertStringEndsWith('Z', $time);
	}

	public function test_ping_exposes_the_application_version(): void
	{
		$response = $this->getJson('/api/v1/ping');

		$response->assertOk();
		$response->assertJsonStructure(['version']);
		$response->assertJson(['version' => config('coevta.version')]);
		$this->assertNotEmpty($response->json('version'));
	}
}
