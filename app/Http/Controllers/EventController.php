<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class EventController extends Controller
{
	public function index(Request $request): AnonymousResourceCollection
	{
		/** @var User $user */
		$user = $request->user();

		return EventResource::collection($user->events()->paginate(25));
	}

	public function store(StoreEventRequest $request): JsonResponse
	{
		/** @var User $user */
		$user = $request->user();

		// Ownership is taken from the token, never the request body.
		$event = $user->events()->create($request->validated());

		return EventResource::make($event)
			->response()
			->setStatusCode(Response::HTTP_CREATED);
	}

	public function show(Request $request, string $event): EventResource
	{
		/** @var User $user */
		$user = $request->user();

		// Scope to the owner: another user's id is simply "not found".
		return EventResource::make($user->events()->findOrFail($event));
	}

	public function update(UpdateEventRequest $request, string $event): EventResource
	{
		/** @var User $user */
		$user = $request->user();

		$model = $user->events()->findOrFail($event);
		$model->update($request->validated());

		return EventResource::make($model);
	}

	public function destroy(Request $request, string $event): Response
	{
		/** @var User $user */
		$user = $request->user();

		$user->events()->findOrFail($event)->delete();

		return response()->noContent();
	}
}
