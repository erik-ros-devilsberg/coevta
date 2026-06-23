<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Carbon;

/**
 * A task — a minimalist, Google Tasks-compatible to-do item.
 *
 * Completion is represented solely by completed_at (null = open).
 *
 * @property string $id
 * @property string $title
 * @property string|null $notes
 * @property Carbon|null $due_at
 * @property bool $due_has_time
 * @property Carbon|null $completed_at
 */
class Task extends BaseModel
{
	/** @use HasFactory<\Database\Factories\TaskFactory> */
	use HasFactory;

	/**
	 * Tasks carry no created_at/updated_at.
	 */
	public $timestamps = false;

	/**
	 * @var list<string>
	 */
	protected $fillable = [
		'title',
		'notes',
		'due_at',
		'due_has_time',
		'completed_at',
	];

	/**
	 * @return array<string, string>
	 */
	protected function casts(): array
	{
		return [
			'due_at' => 'datetime',
			'due_has_time' => 'boolean',
			'completed_at' => 'datetime',
		];
	}
}
