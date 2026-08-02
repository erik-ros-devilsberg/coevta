<?php

use Illuminate\Support\Facades\Route;

// The web surface is a single page. Everything else this project does is an API
// under /api/v1 — see routes/api.php.
//
// The landing page is a static asset, not a server-rendered view. We return the
// file's contents as HTML (no Blade, no templating). In production the web
// server can serve public/landing.html directly; this route is the fallback so
// `/` works under `artisan serve`, which routes everything through PHP.
Route::get('/', fn () => response(
	(string) file_get_contents(public_path('landing.html')),
)->header('Content-Type', 'text/html'))->name('home');
