<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class EventController extends Controller
{
	public function index(): AnonymousResourceCollection
	{
		return EventResource::collection(Event::paginate(25));
	}

	public function store(StoreEventRequest $request): JsonResponse
	{
		$event = Event::create($request->validated());

		return EventResource::make($event)
			->response()
			->setStatusCode(Response::HTTP_CREATED);
	}

	public function show(Event $event): EventResource
	{
		return EventResource::make($event);
	}

	public function update(UpdateEventRequest $request, Event $event): EventResource
	{
		$event->update($request->validated());

		return EventResource::make($event);
	}

	public function destroy(Event $event): Response
	{
		$event->delete();

		return response()->noContent();
	}
}
