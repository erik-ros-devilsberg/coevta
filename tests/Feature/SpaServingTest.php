<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The authenticated app is a static Vue SPA. These routes serve the same static
 * shell with no server-side rendering and no session-auth redirect — the SPA
 * handles auth client-side against the API.
 */
class SpaServingTest extends TestCase
{
	private function assertServesShell(string $path): void
	{
		$response = $this->get($path);

		$response->assertOk();
		// The Vue mount point and the built bundle are present in the shell.
		$response->assertSee('id="app"', escape: false);
		$response->assertSee('/spa/app.js', escape: false);
	}

	public function test_login_route_serves_the_static_shell(): void
	{
		$this->assertServesShell('/login');
	}

	public function test_dashboard_route_serves_the_static_shell(): void
	{
		$this->assertServesShell('/dashboard');
	}

	public function test_reset_password_route_serves_the_static_shell(): void
	{
		$this->assertServesShell('/reset-password');
	}

	public function test_dashboard_is_not_redirected_server_side(): void
	{
		// Auth is enforced client-side; the server must not 302 guests away.
		$this->get('/dashboard')->assertOk();
	}

	public function test_spa_loads_the_central_devilsberg_stylesheet(): void
	{
		$this->get('/login')->assertSee('css/main.css', escape: false);
	}
}
