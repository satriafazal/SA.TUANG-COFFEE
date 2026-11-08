<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MidtransPaymentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('services.midtrans.server_key', 'SB-Mid-server-test-secret-key-123');
        Config::set('services.midtrans.client_key', 'SB-Mid-client-test-key-456');
    }

    public function test_guest_can_create_online_order_and_receive_snap_token(): void
    {
        $category = Category::create(['name' => 'Signature', 'slug' => 'signature', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Americano',
            'slug' => 'americano',
            'item_type' => 'drink',
            'price' => '20000.00',
            'is_active' => true,
            'is_available' => true,
        ]);

        // Mock Midtrans Snap API call
        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token' => 'mock-snap-test-token-777',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-snap-test-token-777',
            ], 201),
        ]);

        $response = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Budi Midtrans',
            'customer_phone' => '081234567890',
            'guest_device_token' => 'guest-dev-online-1',
            'payment_method' => 'midtrans',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('order.customer_name', 'Budi Midtrans')
            ->assertJsonPath('order.payment_method', 'midtrans')
            ->assertJsonPath('order.payment_status', 'MENUNGGU')
            ->assertJsonPath('order.snap_token', 'mock-snap-test-token-777')
            ->assertJsonPath('order.snap_redirect_url', 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-snap-test-token-777');

        $this->assertDatabaseHas('orders', [
            'customer_name' => 'Budi Midtrans',
            'payment_method' => 'midtrans',
            'payment_status' => 'MENUNGGU',
        ]);

        $this->assertDatabaseHas('payments', [
            'method' => 'midtrans',
            'provider' => 'midtrans',
            'provider_reference' => 'mock-snap-test-token-777',
            'status' => 'MENUNGGU',
        ]);
    }

    public function test_midtrans_webhook_settlement_marks_order_as_paid_and_creates_print_jobs(): void
    {
        $category = Category::create(['name' => 'Coffee', 'slug' => 'coffee', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Caramel Latte',
            'slug' => 'caramel-latte',
            'item_type' => 'drink',
            'price' => '30000.00',
            'is_active' => true,
            'is_available' => true,
        ]);

        $member = Customer::create([
            'name' => 'Member Setia',
            'email' => 'setia@example.com',
            'phone' => '089876543210',
            'password' => bcrypt('password123'),
            'points_balance' => 0,
        ]);

        $order = Order::create([
            'order_number' => 'ST-261103-ONLINE1',
            'daily_ticket_number' => '#042',
            'customer_id' => $member->id,
            'customer_name' => 'Member Setia',
            'customer_phone' => '089876543210',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'midtrans',
            'subtotal' => '30000.00',
            'discount_total' => '0.00',
            'points_discount' => '0.00',
            'total' => '30000.00',
            'points_redeemed' => 0,
            'expires_at' => now()->addMinutes(15),
        ]);

        $order->payments()->create([
            'method' => 'midtrans',
            'provider' => 'midtrans',
            'provider_reference' => 'snap-token-abc-123',
            'amount' => '30000.00',
            'status' => 'MENUNGGU',
        ]);

        $orderId = 'ST-261103-ONLINE1';
        $statusCode = '200';
        $grossAmount = '30000.00';
        $serverKey = 'SB-Mid-server-test-secret-key-123';
        $validSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

        $webhookPayload = [
            'order_id' => $orderId,
            'status_code' => $statusCode,
            'gross_amount' => $grossAmount,
            'signature_key' => $validSignature,
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
            'transaction_time' => now()->toDateTimeString(),
        ];

        $response = $this->postJson('/api/v1/payments/midtrans-webhook', $webhookPayload);

        $response->assertOk()
            ->assertJsonPath('order_status', 'PESANAN_DITERIMA')
            ->assertJsonPath('payment_status', 'BERHASIL');

        $this->assertDatabaseHas('orders', [
            'order_number' => $orderId,
            'order_status' => 'PESANAN_DITERIMA',
            'payment_status' => 'BERHASIL',
            'expires_at' => null,
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'status' => 'BERHASIL',
        ]);

        // Member should be awarded points: 30000 / 10000 = 3 points
        $this->assertEquals(3, $member->fresh()->points_balance);

        // Print jobs should be queued
        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $order->id,
            'document_type' => 'invoice',
        ]);
        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $order->id,
            'document_type' => 'kot',
        ]);
    }

    public function test_midtrans_webhook_rejects_invalid_signature(): void
    {
        $order = Order::create([
            'order_number' => 'ST-261103-FAKE99',
            'customer_name' => 'Hacker Test',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'midtrans',
            'subtotal' => '20000.00',
            'total' => '20000.00',
        ]);

        $webhookPayload = [
            'order_id' => 'ST-261103-FAKE99',
            'status_code' => '200',
            'gross_amount' => '20000.00',
            'signature_key' => 'invalid-fabricated-signature-hash',
            'transaction_status' => 'settlement',
        ];

        $this->postJson('/api/v1/payments/midtrans-webhook', $webhookPayload)
            ->assertStatus(403);

        $this->assertDatabaseHas('orders', [
            'order_number' => 'ST-261103-FAKE99',
            'payment_status' => 'MENUNGGU',
        ]);
    }

    public function test_midtrans_webhook_cancels_order_on_expire(): void
    {
        $order = Order::create([
            'order_number' => 'ST-261103-EXPIRE1',
            'customer_name' => 'Expired Customer',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'midtrans',
            'subtotal' => '20000.00',
            'total' => '20000.00',
        ]);

        $order->payments()->create([
            'method' => 'midtrans',
            'provider' => 'midtrans',
            'status' => 'MENUNGGU',
            'amount' => '20000.00',
        ]);

        $orderId = 'ST-261103-EXPIRE1';
        $statusCode = '202';
        $grossAmount = '20000.00';
        $serverKey = 'SB-Mid-server-test-secret-key-123';
        $validSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

        $webhookPayload = [
            'order_id' => $orderId,
            'status_code' => $statusCode,
            'gross_amount' => $grossAmount,
            'signature_key' => $validSignature,
            'transaction_status' => 'expire',
        ];

        $this->postJson('/api/v1/payments/midtrans-webhook', $webhookPayload)
            ->assertOk()
            ->assertJsonPath('order_status', 'DIBATALKAN')
            ->assertJsonPath('payment_status', 'GAGAL');

        $this->assertDatabaseHas('orders', [
            'order_number' => $orderId,
            'order_status' => 'DIBATALKAN',
            'payment_status' => 'GAGAL',
        ]);
    }

    public function test_my_orders_auto_syncs_pending_midtrans_order_with_status_api(): void
    {
        $deviceToken = 'dev-token-sync-test';
        $order = Order::create([
            'order_number' => 'ST-261103-SYNC01',
            'daily_ticket_number' => '#077',
            'customer_name' => 'Sync Test User',
            'guest_device_token' => $deviceToken,
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'midtrans',
            'subtotal' => '25000.00',
            'total' => '25000.00',
            'expires_at' => now()->addMinutes(15),
        ]);

        $order->payments()->create([
            'method' => 'midtrans',
            'provider' => 'midtrans',
            'provider_reference' => 'snap-sync-token',
            'status' => 'MENUNGGU',
            'amount' => '25000.00',
        ]);

        // Mock Midtrans Status API returning settlement
        Http::fake([
            'https://api.sandbox.midtrans.com/v2/ST-261103-SYNC01/status' => Http::response([
                'status_code' => '200',
                'transaction_id' => 'midtrans-trx-999',
                'order_id' => 'ST-261103-SYNC01',
                'gross_amount' => '25000.00',
                'payment_type' => 'bank_transfer',
                'transaction_status' => 'settlement',
                'fraud_status' => 'accept',
            ], 200),
        ]);

        // Calling my-orders automatically checks Midtrans API and updates order status!
        $response = $this->getJson("/api/v1/orders/my-orders?device_token={$deviceToken}");

        $response->assertOk()
            ->assertJsonPath('orders.0.order_number', 'ST-261103-SYNC01')
            ->assertJsonPath('orders.0.order_status', 'PESANAN_DITERIMA')
            ->assertJsonPath('orders.0.payment_status', 'BERHASIL');

        $this->assertDatabaseHas('orders', [
            'order_number' => 'ST-261103-SYNC01',
            'order_status' => 'PESANAN_DITERIMA',
            'payment_status' => 'BERHASIL',
        ]);
    }

    public function test_sync_payment_endpoint_updates_order_status_from_midtrans(): void
    {
        $order = Order::create([
            'order_number' => 'ST-261103-SYNC02',
            'customer_name' => 'Endpoint Sync User',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'midtrans',
            'subtotal' => '20000.00',
            'total' => '20000.00',
            'expires_at' => now()->addMinutes(15),
        ]);

        $order->payments()->create([
            'method' => 'midtrans',
            'provider' => 'midtrans',
            'provider_reference' => 'snap-sync-token-2',
            'status' => 'MENUNGGU',
            'amount' => '20000.00',
        ]);

        Http::fake([
            'https://api.sandbox.midtrans.com/v2/ST-261103-SYNC02/status' => Http::response([
                'status_code' => '200',
                'order_id' => 'ST-261103-SYNC02',
                'gross_amount' => '20000.00',
                'payment_type' => 'qris',
                'transaction_status' => 'settlement',
                'fraud_status' => 'accept',
            ], 200),
        ]);

        $res = $this->postJson('/api/v1/orders/ST-261103-SYNC02/sync-payment');

        $res->assertOk()
            ->assertJsonPath('order.order_status', 'PESANAN_DITERIMA')
            ->assertJsonPath('order.payment_status', 'BERHASIL');
    }
}

