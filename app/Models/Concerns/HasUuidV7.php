<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Concerns\HasUuids;

/**
 * Gives an Eloquent model UUID v7 string primary keys.
 *
 * Laravel's built-in HasUuids already generates v7 UUIDs (via Str::uuid7()) and
 * configures the model for non-incrementing string keys. This project-level
 * trait names that intent explicitly so entity models read clearly and we keep
 * a single seam to change should the id strategy ever evolve.
 */
trait HasUuidV7
{
	use HasUuids;
}
