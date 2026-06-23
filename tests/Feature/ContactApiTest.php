<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ContactApiTest extends TestCase
{
	use RefreshDatabase;

	private function actAsUser(): void
	{
		Sanctum::actingAs(User::factory()->create());
	}

	private function validPayload(array $overrides = []): array
	{
		return array_merge([
			'display_name' => 'Ada Lovelace',
			'given_name' => 'Ada',
			'family_name' => 'Lovelace',
			'email' => 'ada@example.com',
			'phone' => '+44 20 7946 0000',
			'organization' => 'Analytical Engines Ltd',
			'notes' => 'First programmer.',
			'address' => '12 Mayfair, London',
			'birthday' => '1815-12-10',
		], $overrides);
	}

	// --- Authentication -----------------------------------------------------

	public static function endpointProvider(): array
	{
		return [
			'index' => ['get', '/api/v1/contacts'],
			'show' => ['get', '/api/v1/contacts/some-id'],
			'store' => ['post', '/api/v1/contacts'],
			'update' => ['put', '/api/v1/contacts/some-id'],
			'destroy' => ['delete', '/api/v1/contacts/some-id'],
		];
	}

	#[DataProvider('endpointProvider')]
	public function test_every_endpoint_requires_authentication(string $method, string $uri): void
	{
		$response = $this->json($method, $uri);

		$response->assertUnauthorized();
		$response->assertJsonStructure(['message']);
	}

	// --- Index --------------------------------------------------------------

	public function test_index_returns_paginated_collection(): void
	{
		$this->actAsUser();
		Contact::factory()->count(30)->create();

		$response = $this->getJson('/api/v1/contacts');

		$response->assertOk();
		$response->assertJsonCount(25, 'data');
		$response->assertJsonPath('meta.per_page', 25);
		$response->assertJsonPath('meta.total', 30);
	}

	// --- Show ---------------------------------------------------------------

	public function test_show_returns_a_single_contact(): void
	{
		$this->actAsUser();
		$contact = Contact::factory()->create();

		$response = $this->getJson("/api/v1/contacts/{$contact->id}");

		$response->assertOk();
		$response->assertJsonPath('data.id', $contact->id);
		$response->assertJsonPath('data.display_name', $contact->display_name);
	}

	public function test_show_unknown_contact_returns_404(): void
	{
		$this->actAsUser();

		$response = $this->getJson('/api/v1/contacts/non-existent');

		$response->assertNotFound();
		$response->assertJsonStructure(['message']);
	}

	// --- Store --------------------------------------------------------------

	public function test_store_creates_a_contact_with_uuid_v7_id(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/contacts', $this->validPayload());

		$response->assertCreated();
		$response->assertJsonPath('data.display_name', 'Ada Lovelace');
		$response->assertJsonPath('data.birthday', '1815-12-10');

		$id = $response->json('data.id');
		$this->assertNotNull($id);
		// UUID v7: the version nibble (first char of the 3rd group) is '7'.
		$this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id);
		$this->assertDatabaseHas('contacts', ['id' => $id, 'email' => 'ada@example.com']);
	}

	public function test_store_requires_display_name(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/contacts', $this->validPayload(['display_name' => null]));

		$response->assertStatus(422);
		$response->assertJsonValidationErrors('display_name');
	}

	public function test_store_rejects_malformed_email(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/contacts', $this->validPayload(['email' => 'not-an-email']));

		$response->assertStatus(422);
		$response->assertJsonValidationErrors('email');
	}

	public function test_store_rejects_malformed_birthday(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/contacts', $this->validPayload(['birthday' => 'not-a-date']));

		$response->assertStatus(422);
		$response->assertJsonValidationErrors('birthday');
	}

	public function test_store_ignores_unknown_fields(): void
	{
		$this->actAsUser();

		$response = $this->postJson('/api/v1/contacts', $this->validPayload(['is_admin' => true, 'foo' => 'bar']));

		$response->assertCreated();
		$response->assertJsonMissingPath('data.is_admin');
		$response->assertJsonMissingPath('data.foo');
	}

	public function test_resource_exposes_exactly_the_agreed_fields(): void
	{
		$this->actAsUser();
		$contact = Contact::factory()->create();

		$data = $this->getJson("/api/v1/contacts/{$contact->id}")->json('data');

		$expected = [
			'id', 'display_name', 'given_name', 'family_name',
			'email', 'phone', 'organization', 'notes', 'address', 'birthday',
		];
		sort($expected);
		$actual = array_keys($data);
		sort($actual);

		$this->assertSame($expected, $actual);
	}

	// --- Update (PUT only) --------------------------------------------------

	public function test_update_replaces_a_contact(): void
	{
		$this->actAsUser();
		$contact = Contact::factory()->create(['display_name' => 'Old Name']);

		$response = $this->putJson("/api/v1/contacts/{$contact->id}", $this->validPayload(['display_name' => 'New Name']));

		$response->assertOk();
		$response->assertJsonPath('data.display_name', 'New Name');
		$this->assertDatabaseHas('contacts', ['id' => $contact->id, 'display_name' => 'New Name']);
	}

	public function test_update_unknown_contact_returns_404(): void
	{
		$this->actAsUser();

		$response = $this->putJson('/api/v1/contacts/non-existent', $this->validPayload());

		$response->assertNotFound();
	}

	public function test_update_requires_display_name(): void
	{
		$this->actAsUser();
		$contact = Contact::factory()->create();

		$response = $this->putJson("/api/v1/contacts/{$contact->id}", $this->validPayload(['display_name' => null]));

		$response->assertStatus(422);
		$response->assertJsonValidationErrors('display_name');
	}

	public function test_patch_is_not_allowed(): void
	{
		$this->actAsUser();
		$contact = Contact::factory()->create();

		$response = $this->patchJson("/api/v1/contacts/{$contact->id}", $this->validPayload());

		$response->assertStatus(405);
	}

	// --- Destroy ------------------------------------------------------------

	public function test_destroy_removes_a_contact(): void
	{
		$this->actAsUser();
		$contact = Contact::factory()->create();

		$response = $this->deleteJson("/api/v1/contacts/{$contact->id}");

		$response->assertNoContent();
		$this->assertDatabaseMissing('contacts', ['id' => $contact->id]);
	}

	public function test_destroy_unknown_contact_returns_404(): void
	{
		$this->actAsUser();

		$response = $this->deleteJson('/api/v1/contacts/non-existent');

		$response->assertNotFound();
	}
}
