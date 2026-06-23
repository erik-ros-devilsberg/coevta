<?php

namespace Database\Factories;

use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
	/**
	 * @return array<string, mixed>
	 */
	public function definition(): array
	{
		return [
			'title' => $this->faker->sentence(3),
			'notes' => $this->faker->optional()->paragraph(),
			'due_at' => Carbon::instance($this->faker->dateTimeBetween('now', '+1 month'))
				->setTimezone('UTC'),
			'due_has_time' => true,
			'completed_at' => null,
		];
	}
}
