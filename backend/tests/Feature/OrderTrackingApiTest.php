<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OrderTrackingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_track_order_with_order_number_and_customer_name(): void
    {
        $now = now();
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'ST-261016-ABC123',
            'customer_name' => 'Dewi',
            'order_status' => 'SEDANG_DIBUAT',
            'payment_status' => 'BERHASIL',
            'payment_method' => 'cash',
            'subtotal' => 30000,
            'total' => 30000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('order_items')->insert([
            'order_id' => $orderId,
            'product_name_snapshot' => 'Kopi Susu',
            'item_type' => 'drink',
            'quantity' => 1,
            'unit_price' => 30000,
            'line_total' => 30000,
            'preparation_status' => 'SIAP',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->getJson('/api/v1/orders/ST-261016-ABC123/status?customer_name=Dewi')
            ->assertOk()
            ->assertJsonPath('order.order_status', 'SEDANG_DIBUAT')
            ->assertJsonPath('order.items.0.preparation_status', 'SIAP');
    }

    public function test_guest_cannot_track_an_order_using_a_mismatched_name(): void
    {
        $now = now();
        DB::table('orders')->insert([
            'order_number' => 'ST-261016-ABC123',
            'customer_name' => 'Dewi',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'cash',
            'subtotal' => 30000,
            'total' => 30000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->getJson('/api/v1/orders/ST-261016-ABC123/status?customer_name=Orang%20Lain')
            ->assertNotFound();
    }

    public function test_customer_can_mark_order_as_completed_when_ready_for_pickup(): void
    {
        $now = now();
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'ST-261016-READY1',
            'customer_name' => 'Budi',
            'guest_device_token' => 'guest-dev-abc',
            'order_status' => 'SIAP_DIAMBIL',
            'payment_status' => 'BERHASIL',
            'payment_method' => 'cash',
            'subtotal' => 25000,
            'total' => 25000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->postJson('/api/v1/orders/ST-261016-READY1/complete', [
            'device_token' => 'guest-dev-abc',
        ])
            ->assertOk()
            ->assertJsonPath('order.order_status', 'SELESAI');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'order_status' => 'SELESAI',
        ]);
    }

    public function test_customer_cannot_complete_order_if_not_ready(): void
    {
        $now = now();
        DB::table('orders')->insert([
            'order_number' => 'ST-261016-PREP1',
            'customer_name' => 'Budi',
            'guest_device_token' => 'guest-dev-abc',
            'order_status' => 'SEDANG_DIBUAT',
            'payment_status' => 'BERHASIL',
            'payment_method' => 'cash',
            'subtotal' => 25000,
            'total' => 25000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->postJson('/api/v1/orders/ST-261016-PREP1/complete', [
            'device_token' => 'guest-dev-abc',
        ])->assertStatus(409);
    }
}
