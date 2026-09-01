<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
	public function up(): void
	{
		Schema::table('tasks', function (Blueprint $table) {
			// Optional estimate of how long the task takes, in whole minutes.
			// null = unknown. Capped at 7 days (10080) by the request
			// normalization, which fits comfortably in a small integer.
			$table->unsignedSmallInteger('duration')->nullable()->after('due_has_time');
		});
	}

	public function down(): void
	{
		Schema::table('tasks', function (Blueprint $table) {
			$table->dropColumn('duration');
		});
	}
};
