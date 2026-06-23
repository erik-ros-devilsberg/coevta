<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A contact — a minimalist, Google People-compatible person record.
 *
 * @property int $user_id
 * @property string $id
 * @property string $display_name
 * @property string|null $given_name
 * @property string|null $family_name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $organization
 * @property string|null $notes
 * @property string|null $address
 * @property Carbon|null $birthday
 */
class Contact extends BaseModel
{
	/** @use HasFactory<\Database\Factories\ContactFactory> */
	use HasFactory;

	/**
	 * Contacts carry no created_at/updated_at.
	 */
	public $timestamps = false;

	/**
	 * @var list<string>
	 */
	protected $fillable = [
		'display_name',
		'given_name',
		'family_name',
		'email',
		'phone',
		'organization',
		'notes',
		'address',
		'birthday',
	];

	/**
	 * @return array<string, string>
	 */
	protected function casts(): array
	{
		return [
			'birthday' => 'date:Y-m-d',
		];
	}

	/**
	 * The user who owns this contact.
	 *
	 * @return BelongsTo<User, $this>
	 */
	public function user(): BelongsTo
	{
		return $this->belongsTo(User::class);
	}
}
