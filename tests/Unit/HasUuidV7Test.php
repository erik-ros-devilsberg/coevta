<?php

namespace Tests\Unit;

use App\Models\Concerns\HasUuidV7;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;
use Ramsey\Uuid\Uuid;

class HasUuidV7Test extends TestCase
{
	private function makeModel(): Model
	{
		return new class () extends Model {
			use HasUuidV7;
		};
	}

	public function test_generates_a_version_7_uuid(): void
	{
		$id = $this->makeModel()->newUniqueId();

		$this->assertTrue(Uuid::isValid($id));
		$this->assertSame(7, Uuid::fromString($id)->getFields()->getVersion());
	}

	public function test_uses_non_incrementing_string_keys(): void
	{
		$model = $this->makeModel();

		$this->assertSame('string', $model->getKeyType());
		$this->assertFalse($model->getIncrementing());
	}
}
