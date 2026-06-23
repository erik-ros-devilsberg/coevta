<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\TaskController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// All API routes are versioned under /api/v1. The `api` path prefix is applied
// by bootstrap/app.php; this group adds the version segment.
Route::prefix('v1')->group(function () {
	// Public liveness check — no authentication required.
	Route::get('/ping', HealthController::class)->name('ping');

	// Authenticated routes require a valid Sanctum bearer token.
	Route::middleware('auth:sanctum')->group(function () {
		Route::get('/user', fn (Request $request) => $request->user())->name('user');

		// Contacts: full CRUD. Update is PUT-only (full replacement) — no PATCH.
		Route::apiResource('contacts', ContactController::class)->except('update');
		Route::put('contacts/{contact}', [ContactController::class, 'update'])->name('contacts.update');

		// Events: full CRUD. Update is PUT-only (full replacement) — no PATCH.
		Route::apiResource('events', EventController::class)->except('update');
		Route::put('events/{event}', [EventController::class, 'update'])->name('events.update');

		// Tasks: full CRUD (PUT-only update) + a no-body complete convenience action.
		Route::apiResource('tasks', TaskController::class)->except('update');
		Route::put('tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
		Route::post('tasks/{task}/complete', [TaskController::class, 'complete'])->name('tasks.complete');
	});
});
