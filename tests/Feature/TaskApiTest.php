<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TaskApiTest extends TestCase
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
			'index' => ['get', '/api/v1/tasks'],
			'show' => ['get', '/api/v1/tasks/some-id'],
			'store' => ['post', '/api/v1/tasks'],
			'update' => ['put', '/api/v1/tasks/some-id'],
			'patch' => ['patch', '/api/v1/tasks/some-id'],
			'destroy' => ['delete', '/api/v1/tasks/some-id'],
			'complete' => ['post', '/api/v1/tasks/some-id/complete'],
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

	public function test_index_returns_the_complete_unpaginated_collection(): void
	{
		$this->actAsUser();
		Task::factory()->for($this->user)->count(30)->create();

		$response = $this->getJson('/api/v1/tasks');

		$response->assertOk();
		$response->assertJsonCount(30, 'data');
		$response->assertJsonMissingPath('meta');
		$response->assertJsonMissingPath('links');
	}

	public function test_index_returns_only_the_authenticated_users_tasks(): void
	{
		$this->actAsUser();
		Task::factory()->for($this->user)->count(2)->create();
		Task::factory()->for(User::factory()->create())->count(3)->create();

		$response = $this->getJson('/api/v1/tasks');

		$response->assertOk();
		$response->assertJsonCount(2, 'data');
	}

	public function test_show_returns_a_single_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create();

		$this->getJson("/api/v1/tasks/{$task->id}")
			->assertOk()
			->assertJsonPath('data.id', $task->id);
	}

	public function test_show_unknown_task_returns_404(): void
	{
		$this->actAsUser();

		$this->getJson('/api/v1/tasks/non-existent')
			->assertNotFound()
			->assertJsonStructure(['message']);
	}

	public function test_show_other_users_task_returns_404(): void
	{
		$this->actAsUser();
		$other = Task::factory()->for(User::factory()->create())->create();

		$this->getJson("/api/v1/tasks/{$other->id}")->assertNotFound();
	}

	// --- Store: forgiving defaults -----------------------------------------

	public function test_store_creates_task_with_uuid_v7_id(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['title' => 'Buy milk']);

		$response->assertCreated();
		$response->assertJsonPath('data.title', 'Buy milk');
		$this->assertMatchesRegularExpression(
			'/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/',
			$response->json('data.id')
		);
	}

	public function test_store_assigns_task_to_authenticated_user_ignoring_body_user_id(): void
	{
		$this->actAsUser();
		$other = User::factory()->create();

		$response = $this->postJson('/api/v1/tasks', [
			'title' => 'Mine',
			'user_id' => $other->id,
		]);

		$response->assertCreated();
		$this->assertDatabaseHas('tasks', [
			'id' => $response->json('data.id'),
			'user_id' => $this->user->id,
		]);
	}

	public function test_empty_body_creates_open_task_with_default_title(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', []);

		$response->assertCreated();
		$response->assertJsonPath('data.title', 'Untitled task');
		$response->assertJsonPath('data.due_at', null);
		$response->assertJsonPath('data.completed_at', null);
	}

	public function test_due_at_date_only_round_trips_as_date(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['due_at' => '2026-07-01']);

		$response->assertCreated();
		$response->assertJsonPath('data.due_at', '2026-07-01');
	}

	public function test_due_at_datetime_round_trips_as_iso_utc(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['due_at' => '2026-07-01T14:00:00Z']);

		$response->assertCreated();
		$response->assertJsonPath('data.due_at', '2026-07-01T14:00:00.000000Z');
	}

	public function test_due_at_offset_is_converted_to_utc(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['due_at' => '2026-07-01T14:00:00+02:00']);

		$response->assertCreated();
		$response->assertJsonPath('data.due_at', '2026-07-01T12:00:00.000000Z');
	}

	public function test_unparseable_due_at_becomes_null(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['title' => 'X', 'due_at' => 'banana']);

		$response->assertCreated();
		$response->assertJsonPath('data.due_at', null);
	}

	public function test_completed_at_can_be_set_on_create(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['completed_at' => '2026-07-01T09:00:00Z']);

		$response->assertCreated();
		$response->assertJsonPath('data.completed_at', '2026-07-01T09:00:00.000000Z');
	}

	public function test_store_ignores_unknown_fields(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['title' => 'X', 'status' => 'done', 'foo' => 'bar']);

		$response->assertCreated();
		$response->assertJsonMissingPath('data.status');
		$response->assertJsonMissingPath('data.foo');
	}

	public function test_resource_exposes_exactly_the_agreed_fields(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create();

		$data = $this->getJson("/api/v1/tasks/{$task->id}")->json('data');

		$expected = ['id', 'title', 'notes', 'due_at', 'duration', 'completed_at'];
		sort($expected);
		$actual = array_keys($data);
		sort($actual);

		$this->assertSame($expected, $actual);
	}

	public function test_user_id_is_not_exposed_in_the_response(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create();

		$this->getJson("/api/v1/tasks/{$task->id}")
			->assertOk()
			->assertJsonMissingPath('data.user_id');
	}

	// --- Duration -----------------------------------------------------------

	public function test_store_accepts_a_duration_in_minutes(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/tasks', ['title' => 'Mow lawn', 'duration' => 45]);

		$response->assertCreated();
		// An integer in the JSON, not a string.
		$this->assertSame(45, $response->json('data.duration'));
		$this->assertDatabaseHas('tasks', ['id' => $response->json('data.id'), 'duration' => 45]);
	}

	public function test_store_without_duration_leaves_it_null(): void
	{
		$this->actAsUser();

		$this->postJson('/api/v1/tasks', ['title' => 'Mow lawn'])
			->assertCreated()
			->assertJsonPath('data.duration', null);
	}

	/**
	 * Every value we can make sense of is coerced; the rest become null. None
	 * of these is a 422.
	 */
	public static function durationProvider(): array
	{
		return [
			'numeric string' => ['45', 45],
			'fraction rounds up' => [44.6, 45],
			'fraction rounds down' => [44.4, 44],
			'zero' => [0, null],
			'negative' => [-10, null],
			'word' => ['soon', null],
			'boolean' => [true, null],
			'array' => [[], null],
			'null' => [null, null],
			'above the ceiling clamps' => [20000, 10080],
			'the ceiling itself' => [10080, 10080],
		];
	}

	#[DataProvider('durationProvider')]
	public function test_duration_is_normalized_rather_than_rejected(mixed $sent, ?int $expected): void
	{
		$this->actAsUser();

		$this->postJson('/api/v1/tasks', ['title' => 'X', 'duration' => $sent])
			->assertCreated()
			->assertJsonPath('data.duration', $expected);
	}

	#[DataProvider('durationProvider')]
	public function test_duration_is_normalized_the_same_way_on_patch(mixed $sent, ?int $expected): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['duration' => 30]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['duration' => $sent])
			->assertOk()
			->assertJsonPath('data.duration', $expected);
	}

	public function test_update_without_duration_clears_it(): void
	{
		// PUT is a full replacement — an omitted field resets to its default.
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['duration' => 60]);

		$this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'Replaced'])
			->assertOk()
			->assertJsonPath('data.duration', null);

		$this->assertNull($task->fresh()->duration);
	}

	public function test_update_can_set_a_duration(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['duration' => null]);

		$this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'Timed', 'duration' => 90])
			->assertOk()
			->assertJsonPath('data.duration', 90);

		$this->assertSame(90, $task->fresh()->duration);
	}

	public function test_patch_duration_leaves_the_other_fields_alone(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'title' => 'Write tests',
			'notes' => 'Start with the failing one',
			'due_at' => '2026-07-10T17:00:00Z',
			'due_has_time' => true,
			'duration' => null,
			'completed_at' => null,
		]);

		$response = $this->patchJson("/api/v1/tasks/{$task->id}", ['duration' => 30]);

		$response->assertOk();
		$response->assertJsonPath('data.duration', 30);
		$response->assertJsonPath('data.title', 'Write tests');
		$response->assertJsonPath('data.notes', 'Start with the failing one');
		$response->assertJsonPath('data.due_at', '2026-07-10T17:00:00.000000Z');
		$response->assertJsonPath('data.completed_at', null);
	}

	public function test_patch_keeps_a_stored_duration_it_does_not_carry(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['duration' => 25]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'Renamed'])
			->assertOk()
			->assertJsonPath('data.duration', 25);

		$this->assertSame(25, $task->fresh()->duration);
	}

	// --- Complete convenience endpoint -------------------------------------

	public function test_complete_marks_task_done_with_no_body(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['completed_at' => null]);

		$response = $this->postJson("/api/v1/tasks/{$task->id}/complete");

		$response->assertOk();
		$completedAt = $response->json('data.completed_at');
		$this->assertNotNull($completedAt);
		$this->assertEqualsWithDelta(now()->timestamp, Carbon::parse($completedAt)->timestamp, 5);
		$this->assertNotNull($task->fresh()->completed_at);
	}

	public function test_complete_unknown_task_returns_404(): void
	{
		$this->actAsUser();

		$this->postJson('/api/v1/tasks/non-existent/complete')->assertNotFound();
	}

	public function test_complete_other_users_task_returns_404(): void
	{
		$this->actAsUser();
		$other = Task::factory()->for(User::factory()->create())->create(['completed_at' => null]);

		$this->postJson("/api/v1/tasks/{$other->id}/complete")->assertNotFound();
		$this->assertNull($other->fresh()->completed_at);
	}

	// --- Update (PUT only) / Destroy ---------------------------------------

	public function test_update_replaces_a_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['title' => 'Old']);

		$response = $this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'New']);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'New');
		$this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'New']);
	}

	public function test_update_without_completed_at_reopens_the_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['completed_at' => now()]);

		$response = $this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'Reopened']);

		$response->assertOk();
		$response->assertJsonPath('data.completed_at', null);
		$this->assertNull($task->fresh()->completed_at);
	}

	public function test_update_unknown_task_returns_404(): void
	{
		$this->actAsUser();

		$this->putJson('/api/v1/tasks/non-existent', ['title' => 'X'])->assertNotFound();
	}

	public function test_update_other_users_task_returns_404(): void
	{
		$this->actAsUser();
		$other = Task::factory()->for(User::factory()->create())->create();

		$this->putJson("/api/v1/tasks/{$other->id}", ['title' => 'X'])->assertNotFound();
	}

	// --- Patch (partial update) ---------------------------------------------

	public function test_patch_a_title_leaves_a_completed_task_completed(): void
	{
		// The reason this endpoint exists: the equivalent PUT reopens the task.
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'title' => 'Old',
			'completed_at' => '2026-07-01T09:00:00Z',
		]);

		$response = $this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'New']);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'New');
		$response->assertJsonPath('data.completed_at', '2026-07-01T09:00:00.000000Z');
		$this->assertNotNull($task->fresh()->completed_at);
	}

	public function test_patch_completed_at_null_reopens_a_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['completed_at' => now()]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['completed_at' => null])
			->assertOk()
			->assertJsonPath('data.completed_at', null);

		$this->assertNull($task->fresh()->completed_at);
	}

	public function test_patch_completed_at_completes_an_open_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create(['completed_at' => null]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['completed_at' => '2026-07-02T08:30:00Z'])
			->assertOk()
			->assertJsonPath('data.completed_at', '2026-07-02T08:30:00.000000Z');

		$this->assertNotNull($task->fresh()->completed_at);
	}

	public function test_patch_changes_only_the_field_it_carries(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'title' => 'Write tests',
			'notes' => 'Start with the failing one',
			'due_at' => '2026-07-10T17:00:00Z',
			'due_has_time' => true,
			'completed_at' => null,
		]);

		$response = $this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'Write more tests']);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'Write more tests');
		$response->assertJsonPath('data.notes', 'Start with the failing one');
		$response->assertJsonPath('data.due_at', '2026-07-10T17:00:00.000000Z');
		$response->assertJsonPath('data.completed_at', null);
	}

	public function test_patch_with_an_explicit_null_clears_that_field_only(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'title' => 'Keep me',
			'notes' => 'Drop me',
			'due_at' => '2026-07-10T17:00:00Z',
			'due_has_time' => true,
		]);

		$response = $this->patchJson("/api/v1/tasks/{$task->id}", ['notes' => null]);

		$response->assertOk();
		$response->assertJsonPath('data.notes', null);
		$response->assertJsonPath('data.title', 'Keep me');
		$response->assertJsonPath('data.due_at', '2026-07-10T17:00:00.000000Z');
	}

	public function test_patch_due_at_to_a_date_only_value_drops_the_time(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'due_at' => '2026-07-10T17:00:00Z',
			'due_has_time' => true,
		]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['due_at' => '2026-07-12'])
			->assertOk()
			->assertJsonPath('data.due_at', '2026-07-12');

		$this->assertFalse($task->fresh()->due_has_time);
	}

	public function test_patch_ignores_due_has_time_in_the_body(): void
	{
		// Granularity is derived from due_at, never taken from the client.
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'due_at' => '2026-07-12',
			'due_has_time' => false,
		]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['due_has_time' => true])
			->assertOk()
			->assertJsonPath('data.due_at', '2026-07-12');

		$this->assertFalse($task->fresh()->due_has_time);
	}

	public function test_patch_rejects_a_date_it_cannot_read_and_keeps_the_stored_one(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'due_at' => '2026-07-10T17:00:00Z',
			'due_has_time' => true,
			'completed_at' => '2026-07-01T09:00:00Z',
		]);

		$this->patchJson("/api/v1/tasks/{$task->id}", ['due_at' => 'banana'])
			->assertStatus(422)
			->assertJsonValidationErrors('due_at');

		$this->patchJson("/api/v1/tasks/{$task->id}", ['completed_at' => 'sometime'])
			->assertStatus(422)
			->assertJsonValidationErrors('completed_at');

		$fresh = $task->fresh();
		$this->assertSame('2026-07-10T17:00:00.000000Z', $fresh->due_at?->toIso8601ZuluString('microsecond'));
		$this->assertSame('2026-07-01T09:00:00.000000Z', $fresh->completed_at?->toIso8601ZuluString('microsecond'));
	}

	public function test_patch_with_an_empty_body_changes_nothing(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create([
			'title' => 'Untouched',
			'due_at' => '2026-07-12',
			'due_has_time' => false,
			'completed_at' => '2026-07-01T09:00:00Z',
		]);

		$response = $this->patchJson("/api/v1/tasks/{$task->id}", []);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'Untouched');
		// Date-only stays date-only — the granularity round-trips.
		$response->assertJsonPath('data.due_at', '2026-07-12');
		$response->assertJsonPath('data.completed_at', '2026-07-01T09:00:00.000000Z');
		$this->assertFalse($task->fresh()->due_has_time);
	}

	public function test_patch_ignores_a_user_id_in_the_body(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create();
		$other = User::factory()->create();

		$this->patchJson("/api/v1/tasks/{$task->id}", [
			'title' => 'Renamed',
			'user_id' => $other->id,
		])->assertOk();

		$this->assertSame($this->user->id, $task->fresh()->user_id);
	}

	public function test_patch_unknown_task_returns_404(): void
	{
		$this->actAsUser();

		$this->patchJson('/api/v1/tasks/non-existent', ['title' => 'X'])->assertNotFound();
	}

	public function test_patch_other_users_task_returns_404(): void
	{
		$this->actAsUser();
		$other = Task::factory()->for(User::factory()->create())->create(['title' => 'Theirs']);

		$this->patchJson("/api/v1/tasks/{$other->id}", ['title' => 'Mine'])->assertNotFound();
		$this->assertSame('Theirs', $other->fresh()->title);
	}

	public function test_destroy_removes_a_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->for($this->user)->create();

		$this->deleteJson("/api/v1/tasks/{$task->id}")->assertNoContent();
		$this->assertDatabaseMissing('tasks', ['id' => $task->id]);
	}

	public function test_destroy_unknown_task_returns_404(): void
	{
		$this->actAsUser();

		$this->deleteJson('/api/v1/tasks/non-existent')->assertNotFound();
	}

	public function test_destroy_other_users_task_returns_404(): void
	{
		$this->actAsUser();
		$other = Task::factory()->for(User::factory()->create())->create();

		$this->deleteJson("/api/v1/tasks/{$other->id}")->assertNotFound();
		$this->assertDatabaseHas('tasks', ['id' => $other->id]);
	}
}
