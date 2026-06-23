<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
	public function up(): void
	{
		Schema::create('tasks', function (Blueprint $table) {
			// UUID v7 primary key (see App\Models\BaseModel).
			$table->uuid('id')->primary();

			$table->string('title');
			$table->text('notes')->nullable();
			$table->dateTime('due_at')->nullable();
			// Internal: whether due_at carries a time-of-day (datetime) or is
			// date-only. Drives how due_at is rendered; not exposed in the API.
			$table->boolean('due_has_time')->default(false);
			// null = open, a timestamp = completed.
			$table->dateTime('completed_at')->nullable();

			// No timestamps — tasks deliberately carry no created_at/updated_at.
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('tasks');
	}
};
