<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
	/**
	 * Register any application services.
	 */
	public function register(): void
	{
		//
	}

	/**
	 * Bootstrap any application services.
	 */
	public function boot(): void
	{
		// The reset link in recovery emails points at a client, not the API:
		// whatever consumes this backend owns the "choose a new password" page,
		// reads token + email from the URL and posts them to
		// POST /api/v1/reset-password. Set FRONTEND_URL to that client's origin.
		// This project no longer ships a frontend, so with the default
		// FRONTEND_URL the link has nowhere to land.
		ResetPassword::createUrlUsing(function (mixed $notifiable, string $token): string {
			$configured = config('app.frontend_url');
			$base = is_string($configured) ? rtrim($configured, '/') : '';
			$email = $notifiable instanceof CanResetPassword ? $notifiable->getEmailForPasswordReset() : '';

			return "{$base}/reset-password?token={$token}&email=".urlencode($email);
		});
	}
}
