<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The Calendar PWA is a separate installable app served from its own static
 * shell under /calendar/. These tests pin the serving contract that installation
 * and offline support depend on — and, because /calendar previously served the
 * legacy SPA, that the handover happened cleanly.
 */
class CalendarPwaServingTest extends TestCase
{
	private function assertServesPwaShell(string $path): void
	{
		$response = $this->get($path);

		$response->assertOk();
		// The Vue mount point and this app's own bundle — not the legacy SPA's.
		$response->assertSee('id="app"', escape: false);
		$response->assertSee('/calendar/app.js', escape: false);
	}

	public function test_the_bare_calendar_path_serves_the_pwa(): void
	{
		// No trailing slash, no redirect — the same contract as /contacts and
		// /tasks. This is the URL people have bookmarked from the old SPA.
		$this->get('/calendar')->assertOk();
		$this->assertServesPwaShell('/calendar');
	}

	public function test_the_trailing_slash_path_serves_the_pwa(): void
	{
		$this->assertServesPwaShell('/calendar/');
	}

	public function test_calendar_no_longer_serves_the_legacy_spa(): void
	{
		// The route moved from the SPA to the PWA; serving the old bundle here
		// would load a calendar view that no longer exists.
		$this->get('/calendar')->assertOk()->assertDontSee('/spa/app.js', escape: false);
	}

	public function test_in_scope_login_serves_the_pwa_shell(): void
	{
		// Login lives inside the PWA's scope so an installed app never has to
		// navigate out (which would drop it into a browser tab).
		$this->assertServesPwaShell('/calendar/login');
	}

	public function test_an_unknown_deep_link_serves_the_pwa_shell(): void
	{
		// The client-side router redirects unknown paths to the grid; the server's
		// job is only to hand over the shell rather than 404.
		$this->assertServesPwaShell('/calendar/anything');
	}

	public function test_deep_links_are_not_redirected_server_side(): void
	{
		// Auth is enforced client-side; the server must not 302 guests away.
		$this->get('/calendar/login')->assertOk();
	}

	public function test_the_pwa_shell_links_the_manifest_and_central_stylesheet(): void
	{
		$response = $this->get('/calendar');

		$response->assertSee('/calendar/manifest.webmanifest', escape: false);
		$response->assertSee('/css/main.css', escape: false);
	}

	/**
	 * The catch-all must not answer for anything with a file extension. Those are
	 * real files served by the web server; if PHP returned the shell for them,
	 * the service worker would fail to register and the app would silently lose
	 * offline support.
	 */
	#[DataProvider('staticPwaFiles')]
	public function test_static_files_are_not_swallowed_by_the_catch_all(string $file): void
	{
		$this->get("/calendar/{$file}")->assertNotFound();
	}

	/** @return array<string, array{string}> */
	public static function staticPwaFiles(): array
	{
		return [
			'service worker' => ['sw.js'],
			'manifest' => ['manifest.webmanifest'],
			'bundle' => ['app.js'],
			'icon' => ['icon.svg'],
			'maskable icon' => ['icon-maskable.svg'],
		];
	}

	public function test_the_sibling_apps_still_serve_their_own_shells(): void
	{
		// Three installable apps on one origin; adding the third must not disturb
		// the other two.
		$this->get('/contacts')->assertOk()->assertSee('/contacts/app.js', escape: false);
		$this->get('/tasks')->assertOk()->assertSee('/tasks/app.js', escape: false);
	}

	public function test_the_landing_page_is_unchanged(): void
	{
		$this->get('/')->assertOk()->assertSee('wordmark', escape: false);
	}
}
