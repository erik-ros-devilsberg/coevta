<?php

namespace Database\Factories;

use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<Event>
 */
class EventFactory extends Factory
{
	/**
	 * @return array<string, mixed>
	 */
	public function definition(): array
	{
		$start = Carbon::instance($this->faker->dateTimeBetween('-1 week', '+1 month'))
			->setTimezone('UTC');

		return [
			'title' => $this->faker->sentence(3),
			'description' => $this->faker->optional()->paragraph(),
			'location' => $this->faker->optional()->city(),
			'start_at' => $start,
			'end_at' => $start->copy()->addHour(),
			'all_day' => false,
		];
	}
}
