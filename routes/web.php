<?php

use Illuminate\Support\Facades\Route;

// Public landing page — a static asset, not a server-rendered view. We return
// the file's contents as HTML (no Blade, no templating). In production the web
// server can serve public/landing.html directly; this route is the fallback so
// `/` works under `artisan serve`, which routes everything through PHP.
Route::get('/', fn () => response(
	(string) file_get_contents(public_path('landing.html')),
)->header('Content-Type', 'text/html'))->name('home');

// The authenticated app is a static Vue SPA — there is no server-side rendering
// and no session auth. These routes serve the same static shell; the SPA's
// client-side router renders the right view and authenticates against the API
// with a Sanctum token. Deep links (login, dashboard, reset-password) therefore
// resolve to the shell instead of 404ing.
$spa = fn () => response(
	(string) file_get_contents(public_path('app.html')),
)->header('Content-Type', 'text/html');

Route::get('/login', $spa)->name('login');
Route::get('/dashboard', $spa)->name('dashboard');
Route::get('/contacts', $spa)->name('contacts');
Route::get('/tasks', $spa)->name('tasks');
Route::get('/calendar', $spa)->name('calendar');
Route::get('/reset-password', $spa)->name('password.reset');
