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
		// The reset link in recovery emails points at the client-side frontend
		// (static landing / Vue SPA), not the API. The SPA reads token + email
		// from the URL and posts them to POST /api/v1/reset-password.
		ResetPassword::createUrlUsing(function (mixed $notifiable, string $token): string {
			$configured = config('app.frontend_url');
			$base = is_string($configured) ? rtrim($configured, '/') : '';
			$email = $notifiable instanceof CanResetPassword ? $notifiable->getEmailForPasswordReset() : '';

			return "{$base}/reset-password?token={$token}&email=".urlencode($email);
		});
	}
}
