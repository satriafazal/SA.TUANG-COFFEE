<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CreateOrderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_place_cash_order_with_server_calculated_total(): void
    {
        $now = now();
        $productId = DB::table('products')->insertGetId([
            'name' => 'Kopi Susu',
            'slug' => 'kopi-susu',
            'item_type' => 'drink',
            'price' => 22000,
            'allow_notes' => true,
            'is_available' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $response = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Ayu',
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $productId, 'quantity' => 2, 'special_instructions' => 'Less ice'],
            ],
        ])->assertCreated()
            ->assertJsonPath('order.customer_name', 'Ayu')
            ->assertJsonPath('order.payment_status', 'MENUNGGU')
            ->assertJsonPath('order.order_status', 'MENUNGGU_PEMBAYARAN')
            ->assertJsonPath('order.total', '44000.00');

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'payment_status' => 'MENUNGGU',
            'total' => 44000,
        ]);
        $this->assertDatabaseHas('payments', [
            'order_id' => $response->json('order.id'),
            'method' => 'cash',
            'status' => 'MENUNGGU',
        ]);
    }

    public function test_unavailable_product_is_rejected_without_creating_an_order(): void
    {
        $now = now();
        $productId = DB::table('products')->insertGetId([
            'name' => 'Habis',
            'slug' => 'habis',
            'item_type' => 'food',
            'price' => 18000,
            'is_available' => false,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->postJson('/api/v1/orders', [
            'customer_name' => 'Ayu',
            'payment_method' => 'cash',
            'items' => [['product_id' => $productId, 'quantity' => 1]],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_customer_can_validate_and_apply_promo_code(): void
    {
        $now = now();
        DB::table('promotions')->insert([
            'code' => 'HEMAT10',
            'name' => 'Diskon 10%',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'min_spend' => 30000,
            'max_discount' => 5000,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // Below min spend
        $this->postJson('/api/v1/promotions/validate', [
            'code' => 'HEMAT10',
            'subtotal' => 20000,
        ])->assertUnprocessable()
            ->assertJsonPath('valid', false);

        // Valid subtotal
        $this->postJson('/api/v1/promotions/validate', [
            'code' => 'HEMAT10',
            'subtotal' => 40000,
        ])->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('discount_amount', 4000);

        // Order with promo
        $productId = DB::table('products')->insertGetId([
            'name' => 'Latte',
            'slug' => 'latte',
            'item_type' => 'drink',
            'price' => 20000,
            'allow_notes' => false,
            'is_available' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Budi',
            'payment_method' => 'cash',
            'promo_code' => 'HEMAT10',
            'items' => [
                ['product_id' => $productId, 'quantity' => 2],
            ],
        ])->assertCreated()
            ->assertJsonPath('order.subtotal', '40000.00')
            ->assertJsonPath('order.discount_total', '4000.00')
            ->assertJsonPath('order.total', '36000.00');

        $this->assertDatabaseHas('orders', [
            'id' => $res->json('order.id'),
            'subtotal' => 40000,
            'discount_total' => 4000,
            'total' => 36000,
        ]);
    }

    public function test_customer_can_order_menu_bundle(): void
    {
        $now = now();
        $prod1 = DB::table('products')->insertGetId([
            'name' => 'Kopi',
            'slug' => 'kopi',
            'item_type' => 'drink',
            'price' => 15000,
            'is_available' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $prod2 = DB::table('products')->insertGetId([
            'name' => 'Roti',
            'slug' => 'roti',
            'item_type' => 'food',
            'price' => 12000,
            'is_available' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $bundleId = DB::table('bundles')->insertGetId([
            'name' => 'Paket Sarapan',
            'slug' => 'paket-sarapan',
            'price' => 22000,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('bundle_components')->insert([
            ['bundle_id' => $bundleId, 'product_id' => $prod1, 'quantity' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['bundle_id' => $bundleId, 'product_id' => $prod2, 'quantity' => 1, 'created_at' => $now, 'updated_at' => $now],
        ]);

        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Citra',
            'payment_method' => 'cash',
            'items' => [
                ['bundle_id' => $bundleId, 'quantity' => 1],
            ],
        ])->assertCreated()
            ->assertJsonPath('order.total', '22000.00');

        $this->assertDatabaseHas('order_items', [
            'order_id' => $res->json('order.id'),
            'bundle_id' => $bundleId,
            'product_id' => null,
            'item_type' => 'bundle',
            'unit_price' => 22000,
        ]);
    }
}
