<?php

use App\Http\Controllers\ApiLoginController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\TaskController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// All API routes are versioned under /api/v1. The `api` path prefix is applied
// by bootstrap/app.php; this group adds the version segment.
Route::prefix('v1')->group(function () {
	// Public liveness check — no authentication required.
	Route::get('/ping', HealthController::class)->name('ping');

	// Public login — exchanges credentials for a Sanctum token. Rate-limited.
	Route::post('/login', [ApiLoginController::class, 'login'])
		->middleware('throttle:6,1')
		->name('api.login');

	// Public password recovery. Both endpoints are rate-limited. forgot-password
	// always responds the same way (no account enumeration); reset-password
	// applies a new password given a valid token and revokes existing tokens.
	Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])
		->middleware('throttle:6,1')
		->name('api.password.email');
	Route::post('/reset-password', [PasswordResetController::class, 'reset'])
		->middleware('throttle:6,1')
		->name('api.password.reset');

	// Authenticated routes require a valid Sanctum bearer token.
	Route::middleware('auth:sanctum')->group(function () {
		Route::get('/user', fn (Request $request) => $request->user())->name('user');

		// Revoke the token used for the current request.
		Route::post('/logout', [ApiLoginController::class, 'logout'])->name('api.logout');

		// Contacts: full CRUD. PUT replaces the whole record; PATCH changes only
		// the fields the body carries. They are separate actions because they
		// validate differently — see PatchContactRequest.
		Route::apiResource('contacts', ContactController::class)->except('update');
		Route::put('contacts/{contact}', [ContactController::class, 'update'])->name('contacts.update');
		Route::patch('contacts/{contact}', [ContactController::class, 'patch'])->name('contacts.patch');

		// Events: full CRUD (PUT replaces, PATCH updates in part).
		Route::apiResource('events', EventController::class)->except('update');
		Route::put('events/{event}', [EventController::class, 'update'])->name('events.update');
		Route::patch('events/{event}', [EventController::class, 'patch'])->name('events.patch');

		// Tasks: full CRUD (PUT replaces, PATCH updates in part) + a no-body
		// complete convenience action.
		Route::apiResource('tasks', TaskController::class)->except('update');
		Route::put('tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
		Route::patch('tasks/{task}', [TaskController::class, 'patch'])->name('tasks.patch');
		Route::post('tasks/{task}/complete', [TaskController::class, 'complete'])->name('tasks.complete');
	});
});
