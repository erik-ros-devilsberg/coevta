<?php

use App\Http\Controllers\LoginController;
use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

// Public landing page.
Route::get('/', [PageController::class, 'landing'])->name('home');

// Login form + attempt (session/browser auth). The login attempt is
// rate-limited; the GET route is named `login` so the framework `auth`
// middleware redirects guests here.
Route::get('/login', [LoginController::class, 'showLogin'])->name('login');
Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:6,1');

// Authenticated browser routes.
Route::middleware('auth')->group(function () {
	Route::get('/dashboard', [PageController::class, 'dashboard'])->name('dashboard');
	Route::post('/logout', [LoginController::class, 'logout'])->name('logout');
});
