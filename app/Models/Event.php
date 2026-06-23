<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An event — a minimalist, Google Calendar-compatible calendar entry.
 *
 * @property int $user_id
 * @property string $id
 * @property string $title
 * @property string|null $description
 * @property string|null $location
 * @property Carbon $start_at
 * @property Carbon $end_at
 * @property bool $all_day
 */
class Event extends BaseModel
{
	/** @use HasFactory<\Database\Factories\EventFactory> */
	use HasFactory;

	/**
	 * Events carry no created_at/updated_at.
	 */
	public $timestamps = false;

	/**
	 * @var list<string>
	 */
	protected $fillable = [
		'title',
		'description',
		'location',
		'start_at',
		'end_at',
		'all_day',
	];

	/**
	 * @return array<string, string>
	 */
	protected function casts(): array
	{
		return [
			'start_at' => 'datetime',
			'end_at' => 'datetime',
			'all_day' => 'boolean',
		];
	}

	/**
	 * The user who owns this event.
	 *
	 * @return BelongsTo<User, $this>
	 */
	public function user(): BelongsTo
	{
		return $this->belongsTo(User::class);
	}
}
