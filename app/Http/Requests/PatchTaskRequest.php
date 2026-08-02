<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\MergesPatchIntoStoredRecord;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\User;

/**
 * PATCH is a partial update: only the fields in the body change. This is the
 * safe way to edit a completed task — unlike PUT, leaving completed_at out does
 * not reopen it. The base comes from TaskResource so a date-only due_at stays
 * date-only rather than gaining a time on an unrelated patch.
 */
class PatchTaskRequest extends UpdateTaskRequest
{
	use MergesPatchIntoStoredRecord;

	protected function prepareForValidation(): void
	{
		$task = $this->storedTask();

		if ($task !== null) {
			$this->mergePatchOver(TaskResource::make($task));
		}

		parent::prepareForValidation();
		$this->keepUnreadableDatesForValidation(['due_at', 'completed_at']);
	}

	/**
	 * The task being patched, scoped to its owner.
	 */
	private function storedTask(): ?Task
	{
		/** @var User $user */
		$user = $this->user();
		$id = $this->route('task');

		return is_string($id) ? $user->tasks()->find($id) : null;
	}
}
