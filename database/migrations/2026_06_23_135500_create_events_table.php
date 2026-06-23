<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
	public function up(): void
	{
		Schema::create('events', function (Blueprint $table) {
			// UUID v7 primary key (see App\Models\BaseModel).
			$table->uuid('id')->primary();

			// Owner — each event belongs to exactly one user. Deleting the
			// user removes their events.
			$table->foreignId('user_id')->constrained()->cascadeOnDelete();

			$table->string('title');
			$table->text('description')->nullable();
			$table->string('location')->nullable();
			$table->dateTime('start_at');
			$table->dateTime('end_at');
			$table->boolean('all_day')->default(false);

			// No timestamps — events deliberately carry no created_at/updated_at.
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('events');
	}
};
