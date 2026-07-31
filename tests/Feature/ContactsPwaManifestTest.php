<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The manifest and service worker are committed static files served by the web
 * server, not Laravel routes — so these assert the files themselves. They pin
 * the properties a browser checks before it will offer to install the app, and
 * the scope rule that keeps this PWA separate from the calendar and tasks apps
 * that follow.
 */
class ContactsPwaManifestTest extends TestCase
{
	/** @return array<string, mixed> */
	private function manifest(): array
	{
		$path = public_path('contacts/manifest.webmanifest');
		$this->assertFileExists($path);

		$decoded = json_decode((string) file_get_contents($path), true);
		$this->assertIsArray($decoded, 'The manifest must be valid JSON.');

		return $decoded;
	}

	public function test_the_manifest_is_scoped_to_the_contacts_app(): void
	{
		$manifest = $this->manifest();

		// Scope is what bounds the installed app. A navigation outside it opens a
		// browser tab, and it is what stops this app colliding with the calendar
		// and tasks PWAs on the same origin.
		$this->assertSame('/contacts/', $manifest['scope']);
		$this->assertSame('/contacts/', $manifest['start_url']);
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
			$this->assertStringStartsWith('/contacts/', $icon['src']);
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
		$sw = (string) file_get_contents(public_path('contacts/sw.js'));
		$main = (string) file_get_contents(public_path('css/main.css'));

		preg_match_all("/@import\s+'\.\/([^']+)'/", $main, $matches);
		$this->assertNotEmpty($matches[1], 'Expected main.css to @import its parts.');

		foreach ($matches[1] as $part) {
			$this->assertStringContainsString("/css/{$part}", $sw);
		}
	}

	public function test_the_service_worker_does_not_cache_the_api(): void
	{
		// Contact data is owned by the offline data layer; an HTTP cache would
		// fight with it and serve stale reads.
		$sw = (string) file_get_contents(public_path('contacts/sw.js'));

		$this->assertStringContainsString("url.pathname.startsWith('/api/')", $sw);
	}
}
