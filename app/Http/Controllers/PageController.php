<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

/**
 * Server-rendered (Blade) pages: the public landing page and the
 * authenticated dashboard.
 */
class PageController extends Controller
{
	public function landing(): View
	{
		return view('landing');
	}

	public function dashboard(): View
	{
		return view('dashboard');
	}
}
