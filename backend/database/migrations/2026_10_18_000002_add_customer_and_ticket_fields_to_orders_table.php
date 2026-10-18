<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignId('customer_id')->nullable()->after('user_id')->constrained('customers')->nullOnDelete();
            $table->string('guest_device_token', 96)->nullable()->after('customer_id')->index();
            $table->string('daily_ticket_number', 16)->nullable()->after('order_number')->index();
            $table->timestampTz('expires_at')->nullable()->after('cancelled_at')->index();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropForeign(['customer_id']);
            $table->dropColumn(['customer_id', 'guest_device_token', 'daily_ticket_number', 'expires_at']);
        });
    }
};
