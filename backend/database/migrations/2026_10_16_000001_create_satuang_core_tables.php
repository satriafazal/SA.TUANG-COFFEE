<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 160);
            $table->string('slug', 180)->unique();
            $table->text('description')->nullable();
            $table->string('item_type', 16);
            $table->decimal('price', 12, 2);
            $table->string('image_path')->nullable();
            $table->boolean('allow_notes')->default(false);
            $table->boolean('is_available')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['is_active', 'is_available', 'category_id']);
        });

        Schema::create('bundles', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 160);
            $table->string('slug', 180)->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2);
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('bundle_components', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bundle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->timestampsTz();
            $table->unique(['bundle_id', 'product_id']);
        });

        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->string('order_number', 32)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name', 160);
            $table->string('customer_phone', 32)->nullable();
            $table->string('order_status', 32)->default('MENUNGGU_PEMBAYARAN');
            $table->string('payment_status', 24)->default('MENUNGGU');
            $table->string('payment_method', 24);
            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('points_discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->unsignedInteger('points_redeemed')->default(0);
            $table->jsonb('pricing_snapshot')->nullable();
            $table->string('idempotency_key', 96)->nullable()->unique();
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampsTz();
            $table->index(['order_status', 'created_at']);
            $table->index(['payment_status', 'created_at']);
            $table->index(['customer_name', 'created_at']);
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('bundle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name_snapshot', 160);
            $table->string('item_type', 16);
            $table->unsignedSmallInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->text('special_instructions')->nullable();
            $table->string('preparation_status', 24)->default('MENUNGGU');
            $table->timestampsTz();
            $table->index(['order_id', 'item_type', 'preparation_status']);
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('method', 24);
            $table->string('status', 24)->default('MENUNGGU');
            $table->string('provider', 80)->nullable();
            $table->string('provider_reference', 160)->nullable()->unique();
            $table->string('idempotency_key', 100)->nullable()->unique();
            $table->decimal('amount', 12, 2);
            $table->jsonb('provider_metadata')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('verified_at')->nullable();
            $table->timestampsTz();
            $table->index(['order_id', 'status']);
        });

        Schema::create('order_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['order_id', 'created_at']);
        });

        Schema::create('loyalty_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('rule_type', 24);
            $table->unsignedInteger('version');
            $table->string('name', 160);
            $table->jsonb('configuration');
            $table->boolean('is_active')->default(false);
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->unique(['rule_type', 'version']);
            $table->index(['rule_type', 'is_active']);
        });

        Schema::create('loyalty_ledger_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('loyalty_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->string('entry_type', 24);
            $table->integer('points_delta');
            $table->jsonb('rule_snapshot')->nullable();
            $table->string('idempotency_key', 120)->nullable()->unique();
            $table->text('reason')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reverses_entry_id')->nullable()->constrained('loyalty_ledger_entries')->nullOnDelete();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['member_id', 'created_at']);
            $table->index(['order_id', 'entry_type']);
        });

        Schema::create('print_jobs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('retry_of_id')->nullable()->constrained('print_jobs')->nullOnDelete();
            $table->string('document_type', 16);
            $table->string('destination', 80)->nullable();
            $table->string('status', 24)->default('MENUNGGU');
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->text('last_error')->nullable();
            $table->timestampTz('printed_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'created_at']);
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('subject_type', 100)->nullable();
            $table->string('subject_id', 100)->nullable();
            $table->jsonb('before_snapshot')->nullable();
            $table->jsonb('after_snapshot')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['subject_type', 'subject_id']);
            $table->index(['actor_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('print_jobs');
        Schema::dropIfExists('loyalty_ledger_entries');
        Schema::dropIfExists('loyalty_rules');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('bundle_components');
        Schema::dropIfExists('bundles');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
