<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreContactRequest;
use App\Http\Requests\UpdateContactRequest;
use App\Http\Resources\ContactResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ContactController extends Controller
{
	public function index(Request $request): AnonymousResourceCollection
	{
		/** @var User $user */
		$user = $request->user();

		return ContactResource::collection($user->contacts()->paginate(25));
	}

	public function store(StoreContactRequest $request): JsonResponse
	{
		/** @var User $user */
		$user = $request->user();

		// Ownership is taken from the token, never the request body.
		$contact = $user->contacts()->create($request->validated());

		return ContactResource::make($contact)
			->response()
			->setStatusCode(Response::HTTP_CREATED);
	}

	public function show(Request $request, string $contact): ContactResource
	{
		/** @var User $user */
		$user = $request->user();

		// Scope to the owner: another user's id is simply "not found".
		return ContactResource::make($user->contacts()->findOrFail($contact));
	}

	public function update(UpdateContactRequest $request, string $contact): ContactResource
	{
		/** @var User $user */
		$user = $request->user();

		$model = $user->contacts()->findOrFail($contact);
		$model->update($request->validated());

		return ContactResource::make($model);
	}

	public function destroy(Request $request, string $contact): Response
	{
		/** @var User $user */
		$user = $request->user();

		$user->contacts()->findOrFail($contact)->delete();

		return response()->noContent();
	}
}
