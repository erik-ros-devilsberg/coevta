<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
	/**
	 * @return array<string, mixed>
	 */
	public function definition(): array
	{
		$given = $this->faker->firstName();
		$family = $this->faker->lastName();

		return [
			'user_id' => User::factory(),
			'display_name' => "{$given} {$family}",
			'given_name' => $given,
			'family_name' => $family,
			'email' => $this->faker->unique()->safeEmail(),
			'phone' => $this->faker->phoneNumber(),
			'organization' => $this->faker->company(),
			'notes' => $this->faker->optional()->sentence(),
			'address' => $this->faker->address(),
			'birthday' => $this->faker->date(),
		];
	}
}
