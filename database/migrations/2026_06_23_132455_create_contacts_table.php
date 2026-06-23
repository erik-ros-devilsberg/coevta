<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
	public function up(): void
	{
		Schema::create('contacts', function (Blueprint $table) {
			// UUID v7 primary key (see App\Models\BaseModel).
			$table->uuid('id')->primary();

			$table->string('display_name');
			$table->string('given_name')->nullable();
			$table->string('family_name')->nullable();
			$table->string('email')->nullable();
			$table->string('phone')->nullable();
			$table->string('organization')->nullable();
			$table->text('notes')->nullable();
			$table->string('address')->nullable();
			$table->date('birthday')->nullable();

			// No timestamps — contacts deliberately carry no created_at/updated_at.
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('contacts');
	}
};
