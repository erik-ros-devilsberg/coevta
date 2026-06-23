<?php

namespace App\Http\Resources;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Task
 */
class TaskResource extends JsonResource
{
	/**
	 * @return array<string, mixed>
	 */
	public function toArray(Request $request): array
	{
		return [
			'id' => $this->id,
			'title' => $this->title,
			'notes' => $this->notes,
			// Echo back the granularity we were given: date-only or full UTC datetime.
			'due_at' => $this->dueAtForResponse(),
			'completed_at' => $this->completed_at?->toIso8601ZuluString('microsecond'),
		];
	}

	private function dueAtForResponse(): ?string
	{
		if ($this->due_at === null) {
			return null;
		}

		return $this->due_has_time
			? $this->due_at->toIso8601ZuluString('microsecond')
			: $this->due_at->format('Y-m-d');
	}
}
