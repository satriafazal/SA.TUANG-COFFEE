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
}
