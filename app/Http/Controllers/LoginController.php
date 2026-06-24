<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Browser (session) authentication. Uses the web guard: a successful login
 * starts a session; logout invalidates it.
 */
class LoginController extends Controller
{
	public function showLogin(): View|RedirectResponse
	{
		// Already signed in — no need to show the form.
		if (Auth::check()) {
			return redirect('/dashboard');
		}

		return view('auth.login');
	}

	public function login(LoginRequest $request): RedirectResponse
	{
		$credentials = $request->validated();

		if (! Auth::attempt($credentials)) {
			// Generic message — do not reveal whether the email exists.
			throw ValidationException::withMessages([
				'email' => 'These credentials do not match our records.',
			]);
		}

		// Prevent session fixation.
		$request->session()->regenerate();

		return redirect()->intended('/dashboard');
	}

	public function logout(Request $request): RedirectResponse
	{
		Auth::logout();

		$request->session()->invalidate();
		$request->session()->regenerateToken();

		return redirect('/');
	}
}
