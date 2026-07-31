<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The manifest and service worker are committed static files served by the web
 * server, not Laravel routes — so these assert the files themselves. They pin
 * the properties a browser checks before it will offer to install the app, and
 * the scope and cache-name rules that keep the three PWAs from colliding on the
 * same origin.
 */
class CalendarPwaManifestTest extends TestCase
{
	/** @return array<string, mixed> */
	private function manifest(): array
	{
		$path = public_path('calendar/manifest.webmanifest');
		$this->assertFileExists($path);

		$decoded = json_decode((string) file_get_contents($path), true);
		$this->assertIsArray($decoded, 'The manifest must be valid JSON.');

		return $decoded;
	}

	private function serviceWorker(): string
	{
		return (string) file_get_contents(public_path('calendar/sw.js'));
	}

	public function test_the_manifest_is_scoped_to_the_calendar_app(): void
	{
		$manifest = $this->manifest();

		$this->assertSame('/calendar/', $manifest['scope']);
		$this->assertSame('/calendar/', $manifest['start_url']);
	}

	public function test_the_manifest_declares_the_properties_required_to_install(): void
	{
		$manifest = $this->manifest();

		$this->assertSame('standalone', $manifest['display']);
		$this->assertNotEmpty($manifest['name']);
		$this->assertNotEmpty($manifest['short_name']);
		$this->assertNotEmpty($manifest['icons']);
	}

	public function test_every_declared_icon_exists_and_is_in_scope(): void
	{
		foreach ($this->manifest()['icons'] as $icon) {
			$this->assertStringStartsWith('/calendar/', $icon['src']);
			$this->assertFileExists(public_path(ltrim($icon['src'], '/')));
		}
	}

	public function test_a_maskable_icon_is_provided(): void
	{
		$purposes = array_column($this->manifest()['icons'], 'purpose');

		$this->assertContains('maskable', $purposes);
	}

	public function test_the_service_worker_precaches_every_stylesheet_the_shell_imports(): void
	{
		// main.css only @imports the parts, so each one is a separate request. If
		// the precache lists only main.css the app renders unstyled offline —
		// easy to miss, since it looks fine online.
		$sw = $this->serviceWorker();
		$main = (string) file_get_contents(public_path('css/main.css'));

		preg_match_all("/@import\s+'\.\/([^']+)'/", $main, $matches);
		$this->assertNotEmpty($matches[1], 'Expected main.css to @import its parts.');

		foreach ($matches[1] as $part) {
			$this->assertStringContainsString("/css/{$part}", $sw);
		}
	}

	public function test_the_service_worker_does_not_cache_the_api(): void
	{
		// Event data is owned by the offline data layer; an HTTP cache would fight
		// with it and serve stale reads.
		$this->assertStringContainsString("url.pathname.startsWith('/api/')", $this->serviceWorker());
	}

	public function test_the_cache_name_is_unique_across_all_three_apps(): void
	{
		$names = [];

		foreach (['calendar', 'contacts', 'tasks'] as $app) {
			preg_match("/const CACHE = '([^']+)'/", (string) file_get_contents(public_path("{$app}/sw.js")), $matches);
			$names[$app] = $matches[1];
		}

		$this->assertCount(3, array_unique($names), 'Each app needs its own cache name.');
		$this->assertStringStartsWith('coevta-calendar-', $names['calendar']);
	}

	public function test_activation_only_deletes_this_apps_own_caches(): void
	{
		// A broader prefix here would blow away a sibling app's precached shell
		// every time this worker activated, silently costing it offline support.
		$this->assertStringContainsString("key.startsWith('coevta-calendar-')", $this->serviceWorker());
	}

	public function test_the_precache_list_covers_the_app_shell(): void
	{
		$sw = $this->serviceWorker();

		foreach (['/calendar/', '/calendar/app.js', '/calendar/manifest.webmanifest', '/calendar/icon.svg'] as $asset) {
			$this->assertStringContainsString($asset, $sw);
		}
	}
}
