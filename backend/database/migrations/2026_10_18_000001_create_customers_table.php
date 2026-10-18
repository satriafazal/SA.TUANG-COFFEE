<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 160);
            $table->string('email', 180)->unique();
            $table->string('phone', 32)->unique();
            $table->string('password');
            $table->unsignedInteger('points_balance')->default(0);
            $table->rememberToken();
            $table->timestamps();

            $table->index('phone');
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
