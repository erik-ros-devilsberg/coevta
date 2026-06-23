<?php

namespace App\Http\Resources;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Event
 */
class EventResource extends JsonResource
{
	/**
	 * @return array<string, mixed>
	 */
	public function toArray(Request $request): array
	{
		return [
			'id' => $this->id,
			'title' => $this->title,
			'description' => $this->description,
			'location' => $this->location,
			// Carbon casts serialize to ISO 8601 UTC (trailing Z).
			'start_at' => $this->start_at,
			'end_at' => $this->end_at,
			'all_day' => $this->all_day,
		];
	}
}
