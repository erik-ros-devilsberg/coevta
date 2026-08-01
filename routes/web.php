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
Route::get('/reset-password', $spa)->name('password.reset');
Route::get('/password-reset-complete', $spa)->name('password.reset.complete');

// Each PWA is a separate installable app with its own service worker scope, so
// each has its own static shell rather than sharing the SPA's. Their
// client-side routers own everything below their prefix, hence the catch-alls.
//
// The `[^.]*` constraint keeps these routes off anything with a file extension.
// Real files live in the same directories — sw.js, manifest.webmanifest, app.js,
// the icons — and are served by the web server; a catch-all that swallowed them
// would break installation and offline support in ways that are painful to
// diagnose. The apps' own routes (ids, `new`, `login`, `<id>/edit`) never
// contain a dot.
$pwaShell = fn (string $app) => fn () => response(
	(string) file_get_contents(public_path("{$app}/index.html")),
)->header('Content-Type', 'text/html');

$contactsPwa = $pwaShell('contacts');
Route::get('/contacts', $contactsPwa)->name('contacts');
Route::get('/contacts/{any}', $contactsPwa)->where('any', '[^.]*')->name('contacts.any');

$tasksPwa = $pwaShell('tasks');
Route::get('/tasks', $tasksPwa)->name('tasks');
Route::get('/tasks/{any}', $tasksPwa)->where('any', '[^.]*')->name('tasks.any');

$calendarPwa = $pwaShell('calendar');
Route::get('/calendar', $calendarPwa)->name('calendar');
Route::get('/calendar/{any}', $calendarPwa)->where('any', '[^.]*')->name('calendar.any');
