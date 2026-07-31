<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The Contacts PWA is a separate installable app served from its own static
 * shell under /contacts/. These tests pin the serving contract that installation
 * and offline support depend on: deep links resolve to the shell, and the static
 * files sitting in the same directory are not swallowed by the catch-all route.
 */
class ContactsPwaServingTest extends TestCase
{
	private function assertServesPwaShell(string $path): void
	{
		$response = $this->get($path);

		$response->assertOk();
		// The Vue mount point and this app's own bundle — not the legacy SPA's.
		$response->assertSee('id="app"', escape: false);
		$response->assertSee('/contacts/app.js', escape: false);
	}

	public function test_contacts_root_serves_the_pwa_shell(): void
	{
		$this->assertServesPwaShell('/contacts');
	}

	public function test_in_scope_login_serves_the_pwa_shell(): void
	{
		// Login lives inside the PWA's scope so an installed app never has to
		// navigate out (which would drop it into a browser tab).
		$this->assertServesPwaShell('/contacts/login');
	}

	public function test_new_contact_deep_link_serves_the_pwa_shell(): void
	{
		$this->assertServesPwaShell('/contacts/new');
	}

	public function test_contact_detail_deep_link_serves_the_pwa_shell(): void
	{
		$this->assertServesPwaShell('/contacts/0190f8c2-1e3d-7000-8000-000000000000');
	}

	public function test_contact_edit_deep_link_serves_the_pwa_shell(): void
	{
		$this->assertServesPwaShell('/contacts/0190f8c2-1e3d-7000-8000-000000000000/edit');
	}

	public function test_deep_links_are_not_redirected_server_side(): void
	{
		// Auth is enforced client-side; the server must not 302 guests away.
		$this->get('/contacts/new')->assertOk();
	}

	public function test_the_pwa_shell_links_the_manifest_and_central_stylesheet(): void
	{
		$response = $this->get('/contacts');

		$response->assertSee('/contacts/manifest.webmanifest', escape: false);
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
		$this->get("/contacts/{$file}")->assertNotFound();
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

	public function test_the_landing_page_is_unchanged(): void
	{
		// The pivot must not disturb the public marketing page.
		$this->get('/')->assertOk()->assertSee('wordmark', escape: false);
	}
}
