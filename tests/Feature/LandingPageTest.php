<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The landing page is a static asset served at `/` — there is no server-side
 * rendering. These tests assert it is served and carries the brand shell.
 */
class LandingPageTest extends TestCase
{
	public function test_landing_page_is_served_at_root(): void
	{
		$this->get('/')->assertOk();
	}

	public function test_landing_page_shows_the_brand_wordmark(): void
	{
		$this->get('/')->assertSee('coevta');
	}

	public function test_landing_page_loads_the_central_stylesheet(): void
	{
		// The Devilsberg styling lives in a central, function-split CSS bundle
		// loaded via its entry file.
		$this->get('/')->assertSee('css/main.css', escape: false);
	}

	public function test_landing_page_links_into_the_app(): void
	{
		// A CTA points at the login/app entry.
		$this->get('/')->assertSee('login', escape: false);
	}
}
