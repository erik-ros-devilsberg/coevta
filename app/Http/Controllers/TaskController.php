<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

class TaskController extends Controller
{
	public function index(): AnonymousResourceCollection
	{
		return TaskResource::collection(Task::paginate(25));
	}

	public function store(StoreTaskRequest $request): JsonResponse
	{
		$task = Task::create($request->validated());

		return TaskResource::make($task)
			->response()
			->setStatusCode(Response::HTTP_CREATED);
	}

	public function show(Task $task): TaskResource
	{
		return TaskResource::make($task);
	}

	public function update(UpdateTaskRequest $request, Task $task): TaskResource
	{
		$task->update($request->validated());

		return TaskResource::make($task);
	}

	public function destroy(Task $task): Response
	{
		$task->delete();

		return response()->noContent();
	}

	/**
	 * Convenience: mark a task complete with no request body.
	 */
	public function complete(Task $task): TaskResource
	{
		$task->update(['completed_at' => Carbon::now('UTC')]);

		return TaskResource::make($task);
	}
}
