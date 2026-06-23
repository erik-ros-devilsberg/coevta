<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Issues a Sanctum API token for a user, creating the user if necessary.
 *
 * This is the minimal "standard user" path for a component that has no full
 * user-management story yet: it lets an operator mint a bearer token for a
 * trusted consumer from the command line.
 */
class CreateApiToken extends Command
{
	protected $signature = 'coevta:create-token
		{email : The user email to issue a token for}
		{--name=api : A label for the token}
		{--password= : Password to set when creating a new user (random if omitted)}';

	protected $description = 'Create (or reuse) a user and issue a Sanctum API token';

	public function handle(): int
	{
		$email = (string) $this->argument('email');

		$user = User::firstOrCreate(
			['email' => $email],
			[
				'name' => Str::before($email, '@'),
				'password' => Hash::make($this->option('password') ?: Str::password()),
			],
		);

		$token = $user->createToken((string) $this->option('name'))->plainTextToken;

		$this->info("API token for {$user->email}:");
		$this->line($token);

		return self::SUCCESS;
	}
}
