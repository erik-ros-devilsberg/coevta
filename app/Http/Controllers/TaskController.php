<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

class TaskController extends Controller
{
	public function index(Request $request): AnonymousResourceCollection
	{
		/** @var User $user */
		$user = $request->user();

		return TaskResource::collection($user->tasks()->paginate(25));
	}

	public function store(StoreTaskRequest $request): JsonResponse
	{
		/** @var User $user */
		$user = $request->user();

		// Ownership is taken from the token, never the request body.
		$task = $user->tasks()->create($request->validated());

		return TaskResource::make($task)
			->response()
			->setStatusCode(Response::HTTP_CREATED);
	}

	public function show(Request $request, string $task): TaskResource
	{
		/** @var User $user */
		$user = $request->user();

		// Scope to the owner: another user's id is simply "not found".
		return TaskResource::make($user->tasks()->findOrFail($task));
	}

	public function update(UpdateTaskRequest $request, string $task): TaskResource
	{
		/** @var User $user */
		$user = $request->user();

		$model = $user->tasks()->findOrFail($task);
		$model->update($request->validated());

		return TaskResource::make($model);
	}

	public function destroy(Request $request, string $task): Response
	{
		/** @var User $user */
		$user = $request->user();

		$user->tasks()->findOrFail($task)->delete();

		return response()->noContent();
	}

	/**
	 * Convenience: mark a task complete with no request body.
	 */
	public function complete(Request $request, string $task): TaskResource
	{
		/** @var User $user */
		$user = $request->user();

		$model = $user->tasks()->findOrFail($task);
		$model->update(['completed_at' => Carbon::now('UTC')]);

		return TaskResource::make($model);
	}
}
