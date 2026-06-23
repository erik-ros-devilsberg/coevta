<?php

namespace App\Models;

use App\Models\Concerns\HasUuidV7;
use Illuminate\Database\Eloquent\Model;

/**
 * Base class for coevta domain entities (contacts, events, tasks).
 *
 * Centralises the cross-cutting model decisions made in the foundation sprint —
 * currently UUID v7 string primary keys — so every entity inherits them from a
 * single place. Entity models extend this instead of Eloquent's Model directly.
 */
abstract class BaseModel extends Model
{
	use HasUuidV7;
}
