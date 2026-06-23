<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EventApiTest extends TestCase
{
	use RefreshDatabase;

	private User $user;

	/**
	 * Authenticate as a fresh user and remember them, so records can be
	 * associated with the same user the requests run as.
	 */
	private function actAsUser(): User
	{
		$this->user = User::factory()->create();
		Sanctum::actingAs($this->user);

		return $this->user;
	}

	// --- Authentication -----------------------------------------------------

	public static function endpointProvider(): array
	{
		return [
			'index' => ['get', '/api/v1/events'],
			'show' => ['get', '/api/v1/events/some-id'],
			'store' => ['post', '/api/v1/events'],
			'update' => ['put', '/api/v1/events/some-id'],
			'destroy' => ['delete', '/api/v1/events/some-id'],
		];
	}

	#[DataProvider('endpointProvider')]
	public function test_every_endpoint_requires_authentication(string $method, string $uri): void
	{
		$this->json($method, $uri)
			->assertUnauthorized()
			->assertJsonStructure(['message']);
	}

	// --- Index / Show -------------------------------------------------------

	public function test_index_returns_paginated_collection(): void
	{
		$this->actAsUser();
		Event::factory()->for($this->user)->count(30)->create();

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonCount(25, 'data');
		$response->assertJsonPath('meta.per_page', 25);
		$response->assertJsonPath('meta.total', 30);
	}

	public function test_index_returns_only_the_authenticated_users_events(): void
	{
		$this->actAsUser();
		Event::factory()->for($this->user)->count(2)->create();
		Event::factory()->for(User::factory()->create())->count(3)->create();

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonCount(2, 'data');
		$response->assertJsonPath('meta.total', 2);
	}

	public function test_show_returns_a_single_event(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create();

		$this->getJson("/api/v1/events/{$event->id}")
			->assertOk()
			->assertJsonPath('data.id', $event->id);
	}

	public function test_show_unknown_event_returns_404(): void
	{
		$this->actAsUser();

		$this->getJson('/api/v1/events/non-existent')
			->assertNotFound()
			->assertJsonStructure(['message']);
	}

	public function test_show_other_users_event_returns_404(): void
	{
		$this->actAsUser();
		$other = Event::factory()->for(User::factory()->create())->create();

		$this->getJson("/api/v1/events/{$other->id}")->assertNotFound();
	}

	// --- Store: forgiving defaults -----------------------------------------

	public function test_store_creates_event_with_uuid_v7_id(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', [
			'title' => 'Launch party',
			'start_at' => '2026-07-01T18:00:00Z',
			'end_at' => '2026-07-01T21:00:00Z',
		]);

		$response->assertCreated();
		$response->assertJsonPath('data.title', 'Launch party');
		$this->assertMatchesRegularExpression(
			'/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/',
			$response->json('data.id')
		);
	}

	public function test_store_assigns_event_to_authenticated_user_ignoring_body_user_id(): void
	{
		$this->actAsUser();
		$other = User::factory()->create();

		$response = $this->postJson('/api/v1/events', [
			'title' => 'Mine',
			'user_id' => $other->id,
		]);

		$response->assertCreated();
		$this->assertDatabaseHas('events', [
			'id' => $response->json('data.id'),
			'user_id' => $this->user->id,
		]);
	}

	public function test_empty_body_creates_event_with_all_defaults(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', []);

		$response->assertCreated();
		$response->assertJsonPath('data.title', 'Untitled event');
		$response->assertJsonPath('data.all_day', false);

		$start = Carbon::parse($response->json('data.start_at'));
		$end = Carbon::parse($response->json('data.end_at'));
		$this->assertEqualsWithDelta(now()->timestamp, $start->timestamp, 5);
		$this->assertSame(3600, (int) $start->diffInSeconds($end));
	}

	public function test_missing_end_at_defaults_to_one_hour_after_start(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', ['start_at' => '2026-07-01T18:00:00Z']);

		$response->assertCreated();
		$this->assertSame('2026-07-01T18:00:00.000000Z', $response->json('data.start_at'));
		$this->assertSame('2026-07-01T19:00:00.000000Z', $response->json('data.end_at'));
	}

	public function test_end_before_start_is_reset_to_one_hour_after_start(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', [
			'start_at' => '2026-07-01T18:00:00Z',
			'end_at' => '2026-07-01T09:00:00Z',
		]);

		$response->assertCreated();
		$this->assertSame('2026-07-01T19:00:00.000000Z', $response->json('data.end_at'));
	}

	public function test_end_equal_to_start_is_kept(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', [
			'start_at' => '2026-07-01T18:00:00Z',
			'end_at' => '2026-07-01T18:00:00Z',
		]);

		$response->assertCreated();
		$this->assertSame($response->json('data.start_at'), $response->json('data.end_at'));
	}

	public function test_all_day_snaps_to_whole_day_bounds(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', [
			'start_at' => '2026-07-01T18:30:00Z',
			'all_day' => true,
		]);

		$response->assertCreated();
		$response->assertJsonPath('data.all_day', true);
		$this->assertSame('2026-07-01T00:00:00.000000Z', $response->json('data.start_at'));
		$this->assertSame('2026-07-01T23:59:59.000000Z', $response->json('data.end_at'));
	}

	public function test_timezone_offset_is_converted_to_utc(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', [
			'start_at' => '2026-07-01T14:00:00+02:00',
			'end_at' => '2026-07-01T15:00:00+02:00',
		]);

		$response->assertCreated();
		$this->assertSame('2026-07-01T12:00:00.000000Z', $response->json('data.start_at'));
		$this->assertSame('2026-07-01T13:00:00.000000Z', $response->json('data.end_at'));
	}

	public function test_timezone_less_datetime_is_treated_as_utc(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', ['start_at' => '2026-07-01T14:00:00']);

		$response->assertCreated();
		$this->assertSame('2026-07-01T14:00:00.000000Z', $response->json('data.start_at'));
	}

	public function test_garbage_input_is_defaulted_not_rejected(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', [
			'start_at' => 'banana',
			'all_day' => 'yes-please',
		]);

		$response->assertCreated();
		$start = Carbon::parse($response->json('data.start_at'));
		$this->assertEqualsWithDelta(now()->timestamp, $start->timestamp, 5);
		$this->assertIsBool($response->json('data.all_day'));
	}

	public function test_store_ignores_unknown_fields(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/events', ['title' => 'X', 'foo' => 'bar']);

		$response->assertCreated();
		$response->assertJsonMissingPath('data.foo');
	}

	public function test_resource_exposes_exactly_the_agreed_fields(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create();

		$data = $this->getJson("/api/v1/events/{$event->id}")->json('data');

		$expected = ['id', 'title', 'description', 'location', 'start_at', 'end_at', 'all_day'];
		sort($expected);
		$actual = array_keys($data);
		sort($actual);

		$this->assertSame($expected, $actual);
	}

	public function test_user_id_is_not_exposed_in_the_response(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create();

		$this->getJson("/api/v1/events/{$event->id}")
			->assertOk()
			->assertJsonMissingPath('data.user_id');
	}

	public function test_datetimes_are_iso8601_utc(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create();

		$data = $this->getJson("/api/v1/events/{$event->id}")->json('data');

		$this->assertStringEndsWith('Z', $data['start_at']);
		$this->assertStringEndsWith('Z', $data['end_at']);
	}

	// --- Update (PUT only) / Destroy ---------------------------------------

	public function test_update_replaces_an_event(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create(['title' => 'Old']);

		$response = $this->putJson("/api/v1/events/{$event->id}", [
			'title' => 'New',
			'start_at' => '2026-07-01T18:00:00Z',
		]);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'New');
		$this->assertDatabaseHas('events', ['id' => $event->id, 'title' => 'New']);
	}

	public function test_update_unknown_event_returns_404(): void
	{
		$this->actAsUser();

		$this->putJson('/api/v1/events/non-existent', ['title' => 'X'])
			->assertNotFound();
	}

	public function test_update_other_users_event_returns_404(): void
	{
		$this->actAsUser();
		$other = Event::factory()->for(User::factory()->create())->create();

		$this->putJson("/api/v1/events/{$other->id}", ['title' => 'X'])
			->assertNotFound();
	}

	public function test_patch_is_not_allowed(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create();

		$this->patchJson("/api/v1/events/{$event->id}", ['title' => 'X'])
			->assertStatus(405);
	}

	public function test_destroy_removes_an_event(): void
	{
		$this->actAsUser();
		$event = Event::factory()->for($this->user)->create();

		$this->deleteJson("/api/v1/events/{$event->id}")->assertNoContent();
		$this->assertDatabaseMissing('events', ['id' => $event->id]);
	}

	public function test_destroy_unknown_event_returns_404(): void
	{
		$this->actAsUser();

		$this->deleteJson('/api/v1/events/non-existent')->assertNotFound();
	}

	public function test_destroy_other_users_event_returns_404(): void
	{
		$this->actAsUser();
		$other = Event::factory()->for(User::factory()->create())->create();

		$this->deleteJson("/api/v1/events/{$other->id}")->assertNotFound();
		$this->assertDatabaseHas('events', ['id' => $other->id]);
	}
}
