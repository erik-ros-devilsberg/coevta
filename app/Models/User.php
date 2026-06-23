<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
	use HasApiTokens;
	/** @use HasFactory<UserFactory> */
	use HasFactory;
	use Notifiable;

	/**
	 * Get the attributes that should be cast.
	 *
	 * @return array<string, string>
	 */
	protected function casts(): array
	{
		return [
			'email_verified_at' => 'datetime',
			'password' => 'hashed',
		];
	}

	/**
	 * The contacts owned by this user.
	 *
	 * @return HasMany<Contact, $this>
	 */
	public function contacts(): HasMany
	{
		return $this->hasMany(Contact::class);
	}

	/**
	 * The events owned by this user.
	 *
	 * @return HasMany<Event, $this>
	 */
	public function events(): HasMany
	{
		return $this->hasMany(Event::class);
	}

	/**
	 * The tasks owned by this user.
	 *
	 * @return HasMany<Task, $this>
	 */
	public function tasks(): HasMany
	{
		return $this->hasMany(Task::class);
	}
}
