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
			'patch' => ['patch', '/api/v1/events/some-id'],
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

	/**
	 * Create an event for the given user starting the given number of hours
	 * from now, lasting an hour.
	 */
	private function eventStartingIn(User $user, int $hours): Event
	{
		$start = Carbon::now('UTC')->addHours($hours);

		return Event::factory()->for($user)->create([
			'start_at' => $start,
			'end_at' => $start->copy()->addHour(),
		]);
	}

	public function test_index_returns_all_future_events_unpaginated(): void
	{
		$this->actAsUser();

		for ($i = 1; $i <= 30; $i++) {
			$this->eventStartingIn($this->user, $i);
		}

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonCount(30, 'data');
		$response->assertJsonMissingPath('meta');
		$response->assertJsonMissingPath('links');
	}

	public function test_index_omits_events_that_have_already_finished(): void
	{
		$this->actAsUser();
		$past = $this->eventStartingIn($this->user, -5);
		$future = $this->eventStartingIn($this->user, 5);

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonCount(1, 'data');
		$response->assertJsonPath('data.0.id', $future->id);
		$response->assertJsonMissing(['id' => $past->id]);
	}

	public function test_index_keeps_an_event_that_is_currently_running(): void
	{
		$this->actAsUser();
		$now = Carbon::now('UTC');
		$running = Event::factory()->for($this->user)->create([
			'start_at' => $now->copy()->subMinutes(30),
			'end_at' => $now->copy()->addMinutes(30),
		]);

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonCount(1, 'data');
		$response->assertJsonPath('data.0.id', $running->id);
	}

	public function test_index_returns_events_in_chronological_order(): void
	{
		$this->actAsUser();
		$later = $this->eventStartingIn($this->user, 48);
		$sooner = $this->eventStartingIn($this->user, 2);

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonPath('data.0.id', $sooner->id);
		$response->assertJsonPath('data.1.id', $later->id);
	}

	public function test_index_returns_only_the_authenticated_users_events(): void
	{
		$this->actAsUser();
		$other = User::factory()->create();
		$this->eventStartingIn($this->user, 1);
		$this->eventStartingIn($this->user, 2);
		$this->eventStartingIn($other, 3);
		$this->eventStartingIn($other, 4);
		$this->eventStartingIn($other, 5);

		$response = $this->getJson('/api/v1/events');

		$response->assertOk();
		$response->assertJsonCount(2, 'data');
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

	// --- Patch (partial update) ---------------------------------------------

	/**
	 * A fixed, fully-populated timed event to patch against.
	 */
	private function storedEvent(): Event
	{
		return Event::factory()->for($this->user)->create([
			'title' => 'Stand-up',
			'description' => 'Daily sync',
			'location' => 'Room 2',
			'start_at' => '2026-07-01T10:00:00Z',
			'end_at' => '2026-07-01T11:00:00Z',
			'all_day' => false,
		]);
	}

	public function test_patch_changes_only_the_field_it_carries(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();

		$response = $this->patchJson("/api/v1/events/{$event->id}", ['title' => 'Retro']);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'Retro');
		// The times in particular must survive — normalization runs over the
		// merged record, so a bad merge would quietly reset them to now().
		$response->assertJsonPath('data.description', 'Daily sync');
		$response->assertJsonPath('data.location', 'Room 2');
		$response->assertJsonPath('data.start_at', '2026-07-01T10:00:00.000000Z');
		$response->assertJsonPath('data.end_at', '2026-07-01T11:00:00.000000Z');
		$response->assertJsonPath('data.all_day', false);
	}

	public function test_patch_with_an_explicit_null_clears_that_field_only(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();

		$response = $this->patchJson("/api/v1/events/{$event->id}", ['description' => null]);

		$response->assertOk();
		$response->assertJsonPath('data.description', null);
		$response->assertJsonPath('data.location', 'Room 2');
		$response->assertJsonPath('data.title', 'Stand-up');
	}

	public function test_patch_start_past_the_stored_end_corrects_the_end(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();

		// Forgiving, exactly as PUT is: the end moves rather than 422ing.
		$response = $this->patchJson("/api/v1/events/{$event->id}", [
			'start_at' => '2026-07-01T14:00:00Z',
		]);

		$response->assertOk();
		$response->assertJsonPath('data.start_at', '2026-07-01T14:00:00.000000Z');
		$response->assertJsonPath('data.end_at', '2026-07-01T15:00:00.000000Z');
	}

	public function test_patch_all_day_snaps_the_stored_bounds(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();

		$response = $this->patchJson("/api/v1/events/{$event->id}", ['all_day' => true]);

		$response->assertOk();
		$response->assertJsonPath('data.all_day', true);
		$response->assertJsonPath('data.start_at', '2026-07-01T00:00:00.000000Z');
		$response->assertJsonPath('data.end_at', '2026-07-01T23:59:59.000000Z');
	}

	public function test_patch_rejects_a_date_it_cannot_read_and_keeps_the_stored_one(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();

		// PUT would coerce this to now(); a patch says no rather than moving an
		// event the client never meant to move.
		$this->patchJson("/api/v1/events/{$event->id}", ['start_at' => 'banana'])
			->assertStatus(422)
			->assertJsonValidationErrors('start_at');

		$this->patchJson("/api/v1/events/{$event->id}", ['end_at' => 'whenever'])
			->assertStatus(422)
			->assertJsonValidationErrors('end_at');

		$fresh = $event->fresh();
		$this->assertSame('2026-07-01T10:00:00.000000Z', $fresh->start_at->toIso8601ZuluString('microsecond'));
		$this->assertSame('2026-07-01T11:00:00.000000Z', $fresh->end_at->toIso8601ZuluString('microsecond'));
	}

	public function test_patch_with_an_empty_body_changes_nothing(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();

		$response = $this->patchJson("/api/v1/events/{$event->id}", []);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'Stand-up');
		$response->assertJsonPath('data.start_at', '2026-07-01T10:00:00.000000Z');
		$response->assertJsonPath('data.end_at', '2026-07-01T11:00:00.000000Z');
		$response->assertJsonPath('data.all_day', false);
	}

	public function test_patch_ignores_a_user_id_in_the_body(): void
	{
		$this->actAsUser();
		$event = $this->storedEvent();
		$other = User::factory()->create();

		$this->patchJson("/api/v1/events/{$event->id}", [
			'title' => 'Renamed',
			'user_id' => $other->id,
		])->assertOk();

		$this->assertSame($this->user->id, $event->fresh()->user_id);
	}

	public function test_patch_unknown_event_returns_404(): void
	{
		$this->actAsUser();

		$this->patchJson('/api/v1/events/non-existent', ['title' => 'X'])->assertNotFound();
	}

	public function test_patch_other_users_event_returns_404(): void
	{
		$this->actAsUser();
		$other = Event::factory()->for(User::factory()->create())->create(['title' => 'Theirs']);

		$this->patchJson("/api/v1/events/{$other->id}", ['title' => 'Mine'])->assertNotFound();
		$this->assertSame('Theirs', $other->fresh()->title);
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
