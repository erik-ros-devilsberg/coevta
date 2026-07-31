<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The Tasks PWA is a separate installable app served from its own static shell
 * under /tasks/. These tests pin the serving contract that installation and
 * offline support depend on: deep links resolve to the shell, and the static
 * files sitting in the same directory are not swallowed by the catch-all route.
 */
class TasksPwaServingTest extends TestCase
{
	private function assertServesPwaShell(string $path): void
	{
		$response = $this->get($path);

		$response->assertOk();
		// The Vue mount point and this app's own bundle — not the legacy SPA's.
		$response->assertSee('id="app"', escape: false);
		$response->assertSee('/tasks/app.js', escape: false);
	}

	public function test_tasks_root_serves_the_pwa_shell(): void
	{
		$this->assertServesPwaShell('/tasks');
	}

	public function test_in_scope_login_serves_the_pwa_shell(): void
	{
		// Login lives inside the PWA's scope so an installed app never has to
		// navigate out (which would drop it into a browser tab).
		$this->assertServesPwaShell('/tasks/login');
	}

	public function test_an_unknown_deep_link_serves_the_pwa_shell(): void
	{
		// The client-side router redirects unknown paths to the list; the server's
		// job is only to hand over the shell rather than 404.
		$this->assertServesPwaShell('/tasks/anything');
	}

	public function test_deep_links_are_not_redirected_server_side(): void
	{
		// Auth is enforced client-side; the server must not 302 guests away.
		$this->get('/tasks/login')->assertOk();
	}

	public function test_the_pwa_shell_links_the_manifest_and_central_stylesheet(): void
	{
		$response = $this->get('/tasks');

		$response->assertSee('/tasks/manifest.webmanifest', escape: false);
		$response->assertSee('/css/main.css', escape: false);
	}

	public function test_the_tasks_route_no_longer_serves_the_legacy_spa(): void
	{
		$this->get('/tasks')->assertOk()->assertDontSee('/spa/app.js', escape: false);
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
		$this->get("/tasks/{$file}")->assertNotFound();
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

	public function test_the_contacts_pwa_still_serves_its_own_shell(): void
	{
		// Two installable apps on one origin; adding the second must not disturb
		// the first.
		$this->get('/contacts')->assertOk()->assertSee('/contacts/app.js', escape: false);
	}
}
