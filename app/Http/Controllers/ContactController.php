<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreContactRequest;
use App\Http\Requests\UpdateContactRequest;
use App\Http\Resources\ContactResource;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ContactController extends Controller
{
	public function index(): AnonymousResourceCollection
	{
		return ContactResource::collection(Contact::paginate(25));
	}

	public function store(StoreContactRequest $request): JsonResponse
	{
		$contact = Contact::create($request->validated());

		return ContactResource::make($contact)
			->response()
			->setStatusCode(Response::HTTP_CREATED);
	}

	public function show(Contact $contact): ContactResource
	{
		return ContactResource::make($contact);
	}

	public function update(UpdateContactRequest $request, Contact $contact): ContactResource
	{
		$contact->update($request->validated());

		return ContactResource::make($contact);
	}

	public function destroy(Contact $contact): Response
	{
		$contact->delete();

		return response()->noContent();
	}
}
