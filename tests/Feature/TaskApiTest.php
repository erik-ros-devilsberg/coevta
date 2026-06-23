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

	private function actAsUser(): void
	{
		Sanctum::actingAs(User::factory()->create());
	}

	// --- Authentication -----------------------------------------------------

	public static function endpointProvider(): array
	{
		return [
			'index' => ['get', '/api/v1/tasks'],
			'show' => ['get', '/api/v1/tasks/some-id'],
			'store' => ['post', '/api/v1/tasks'],
			'update' => ['put', '/api/v1/tasks/some-id'],
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

	public function test_index_returns_paginated_collection(): void
	{
		$this->actAsUser();
		Task::factory()->count(30)->create();

		$response = $this->getJson('/api/v1/tasks');

		$response->assertOk();
		$response->assertJsonCount(25, 'data');
		$response->assertJsonPath('meta.per_page', 25);
		$response->assertJsonPath('meta.total', 30);
	}

	public function test_show_returns_a_single_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->create();

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
		$task = Task::factory()->create();

		$data = $this->getJson("/api/v1/tasks/{$task->id}")->json('data');

		$expected = ['id', 'title', 'notes', 'due_at', 'completed_at'];
		sort($expected);
		$actual = array_keys($data);
		sort($actual);

		$this->assertSame($expected, $actual);
	}

	// --- Complete convenience endpoint -------------------------------------

	public function test_complete_marks_task_done_with_no_body(): void
	{
		$this->actAsUser();
		$task = Task::factory()->create(['completed_at' => null]);

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

	// --- Update (PUT only) / Destroy ---------------------------------------

	public function test_update_replaces_a_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->create(['title' => 'Old']);

		$response = $this->putJson("/api/v1/tasks/{$task->id}", ['title' => 'New']);

		$response->assertOk();
		$response->assertJsonPath('data.title', 'New');
		$this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'New']);
	}

	public function test_update_without_completed_at_reopens_the_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->create(['completed_at' => now()]);

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

	public function test_patch_is_not_allowed(): void
	{
		$this->actAsUser();
		$task = Task::factory()->create();

		$this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'X'])->assertStatus(405);
	}

	public function test_destroy_removes_a_task(): void
	{
		$this->actAsUser();
		$task = Task::factory()->create();

		$this->deleteJson("/api/v1/tasks/{$task->id}")->assertNoContent();
		$this->assertDatabaseMissing('tasks', ['id' => $task->id]);
	}

	public function test_destroy_unknown_task_returns_404(): void
	{
		$this->actAsUser();

		$this->deleteJson('/api/v1/tasks/non-existent')->assertNotFound();
	}
}
