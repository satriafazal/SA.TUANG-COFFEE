<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CashierOrderApiTest extends TestCase
{
    use RefreshDatabase;

    private function cashier(): User
    {
        return User::factory()->create(['role' => 'cashier', 'is_active' => true]);
    }

    private function orderWithItems(array $itemTypes = ['drink', 'food']): string
    {
        $now = now();
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'ST-'.strtoupper(bin2hex(random_bytes(6))),
            'customer_name' => 'Pelanggan Uji',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'cash',
            'subtotal' => 50000,
            'total' => 50000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('payments')->insert([
            'order_id' => $orderId,
            'method' => 'cash',
            'status' => 'MENUNGGU',
            'amount' => 50000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        foreach ($itemTypes as $index => $type) {
            DB::table('order_items')->insert([
                'order_id' => $orderId,
                'product_name_snapshot' => 'Item '.$index,
                'item_type' => $type,
                'quantity' => 1,
                'unit_price' => 25000,
                'line_total' => 25000,
                'preparation_status' => 'MENUNGGU',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return DB::table('orders')->where('id', $orderId)->value('order_number');
    }

    public function test_cashier_order_queue_is_universal_for_today_and_resets_daily(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $active = $this->orderWithItems(['drink']);
        $completed = $this->orderWithItems(['food']);
        $cancelled = $this->orderWithItems(['snack']);
        $yesterday = $this->orderWithItems(['coffee']);

        DB::table('orders')->where('order_number', $completed)->update(['order_status' => 'SELESAI', 'completed_at' => now()]);
        DB::table('orders')->where('order_number', $cancelled)->update(['order_status' => 'DIBATALKAN', 'cancelled_at' => now()]);
        DB::table('orders')->where('order_number', $yesterday)->update(['created_at' => now()->subDay()]);

        // Universal queue for today includes all statuses today, but excludes yesterday
        $this->getJson('/api/v1/cashier/orders')
            ->assertOk()
            ->assertJsonFragment(['order_number' => $active])
            ->assertJsonFragment(['order_number' => $completed])
            ->assertJsonFragment(['order_number' => $cancelled])
            ->assertJsonMissing(['order_number' => $yesterday]);

        // Active scope filters out completed and cancelled
        $this->getJson('/api/v1/cashier/orders?scope=active')
            ->assertOk()
            ->assertJsonFragment(['order_number' => $active])
            ->assertJsonMissing(['order_number' => $completed])
            ->assertJsonMissing(['order_number' => $cancelled]);

        // Dedicated endpoints still return completed and cancelled
        $this->getJson('/api/v1/cashier/orders/completed')
            ->assertOk()
            ->assertJsonFragment(['order_number' => $completed]);

        $this->getJson('/api/v1/cashier/orders/cancelled')
            ->assertOk()
            ->assertJsonFragment(['order_number' => $cancelled]);
    }

    public function test_cashier_confirms_cash_payment_and_print_jobs_only_once(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $orderNumber = $this->orderWithItems(['drink']);

        $this->postJson("/api/v1/cashier/orders/{$orderNumber}/confirm-payment")
            ->assertOk()
            ->assertJsonPath('order.payment_status', 'BERHASIL')
            ->assertJsonPath('order.order_status', 'SEDANG_DIBUAT');

        $this->assertDatabaseCount('print_jobs', 2);
        $this->postJson("/api/v1/cashier/orders/{$orderNumber}/confirm-payment")->assertStatus(409);
        $this->assertDatabaseCount('print_jobs', 2);
    }

    public function test_cashier_updates_preparation_by_category_group_and_advance_order_when_all_groups_are_ready(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $orderNumber = $this->orderWithItems(['drink', 'drink', 'food', 'other']);
        $this->postJson("/api/v1/cashier/orders/{$orderNumber}/confirm-payment")->assertOk();

        $this->patchJson("/api/v1/cashier/orders/{$orderNumber}/preparation-groups", ['item_type' => 'drink', 'status' => 'SIAP'])
            ->assertOk()
            ->assertJsonPath('order_status', 'SEDANG_DIBUAT');
        $this->assertDatabaseCount('order_items', 4);
        $this->assertSame(2, DB::table('order_items')->where('order_id', DB::table('orders')->where('order_number', $orderNumber)->value('id'))->where('item_type', 'drink')->where('preparation_status', 'SIAP')->count());
        $this->assertSame(2, DB::table('order_items')->where('order_id', DB::table('orders')->where('order_number', $orderNumber)->value('id'))->whereIn('item_type', ['food', 'other'])->where('preparation_status', 'DIPROSES')->count());

        $this->patchJson("/api/v1/cashier/orders/{$orderNumber}/preparation-groups", ['item_type' => 'food', 'status' => 'DIPROSES'])
            ->assertOk()
            ->assertJsonPath('order_status', 'SEDANG_DIBUAT');
        $this->patchJson("/api/v1/cashier/orders/{$orderNumber}/preparation-groups", ['item_type' => 'food', 'status' => 'SIAP'])
            ->assertOk()
            ->assertJsonPath('order_status', 'SEDANG_DIBUAT');
        $this->patchJson("/api/v1/cashier/orders/{$orderNumber}/preparation-groups", ['item_type' => 'other', 'status' => 'SIAP'])
            ->assertOk()
            ->assertJsonPath('order_status', 'SIAP_DIAMBIL');
    }

    public function test_cashier_endpoints_require_cashier_role_and_blocks_admin(): void
    {
        $orderNumber = $this->orderWithItems(['drink']);
        $this->getJson('/api/v1/cashier/orders')->assertUnauthorized();

        $this->actingAs(User::factory()->create(['role' => 'member']), 'sanctum')
            ->getJson('/api/v1/cashier/orders')
            ->assertForbidden();

        $this->actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]), 'sanctum')
            ->getJson('/api/v1/cashier/orders')
            ->assertForbidden();

        $this->assertDatabaseHas('orders', ['order_number' => $orderNumber]);
    }

    public function test_expired_cash_order_is_auto_cancelled_and_cannot_be_confirmed(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $orderNumber = $this->orderWithItems(['drink']);
        DB::table('orders')->where('order_number', $orderNumber)->update([
            'expires_at' => now()->subMinute(),
        ]);

        // Fetching cashier orders automatically updates expired cash order to DIBATALKAN
        $this->getJson('/api/v1/cashier/orders')->assertOk();

        $this->assertDatabaseHas('orders', [
            'order_number' => $orderNumber,
            'order_status' => 'DIBATALKAN',
        ]);

        // Confirming payment on expired/cancelled order throws 409 Conflict
        $this->postJson("/api/v1/cashier/orders/{$orderNumber}/confirm-payment")
            ->assertStatus(409);
    }

    public function test_cashier_updates_preparation_status_for_order_with_bundle_items_under_drink_group(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $orderNumber = $this->orderWithItems(['bundle', 'food']);
        $this->postJson("/api/v1/cashier/orders/{$orderNumber}/confirm-payment")->assertOk();

        $this->patchJson("/api/v1/cashier/orders/{$orderNumber}/preparation-groups", ['item_type' => 'drink', 'status' => 'SIAP'])
            ->assertOk()
            ->assertJsonPath('order_status', 'SEDANG_DIBUAT');

        $this->assertDatabaseHas('order_items', [
            'item_type' => 'bundle',
            'preparation_status' => 'SIAP',
        ]);
    }

    public function test_cashier_order_queue_excludes_unpaid_online_orders_until_settled(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');

        $now = now();
        // 1. Unpaid online order
        $unpaidOnlineId = DB::table('orders')->insertGetId([
            'order_number' => 'ST-ONLINE-UNPAID',
            'customer_name' => 'Online Pending',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'payment_status' => 'MENUNGGU',
            'payment_method' => 'midtrans',
            'subtotal' => 50000,
            'total' => 50000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('payments')->insert([
            'order_id' => $unpaidOnlineId,
            'method' => 'midtrans',
            'status' => 'MENUNGGU',
            'amount' => 50000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // 2. Paid online order
        $paidOnlineId = DB::table('orders')->insertGetId([
            'order_number' => 'ST-ONLINE-PAID',
            'customer_name' => 'Online Paid',
            'order_status' => 'PESANAN_DITERIMA',
            'payment_status' => 'BERHASIL',
            'payment_method' => 'midtrans',
            'subtotal' => 50000,
            'total' => 50000,
            'confirmed_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('payments')->insert([
            'order_id' => $paidOnlineId,
            'method' => 'midtrans',
            'status' => 'BERHASIL',
            'amount' => 50000,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // 3. Cash pending order
        $cashOrderNumber = $this->orderWithItems(['drink']);

        // Cashier queue must contain Cash pending order and Paid online order, but NOT Unpaid online order
        $response = $this->getJson('/api/v1/cashier/orders')->assertOk();
        $response->assertJsonFragment(['order_number' => $cashOrderNumber]);
        $response->assertJsonFragment(['order_number' => 'ST-ONLINE-PAID']);
        $response->assertJsonMissing(['order_number' => 'ST-ONLINE-UNPAID']);
    }

    public function test_cashier_can_confirm_and_print_online_order(): void
    {
        $cashier = $this->cashier();
        $this->actingAs($cashier, 'sanctum');

        $now = now();
        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'ST-ONLINE-CONFIRM',
            'customer_name' => 'Online Customer',
            'order_status' => 'PESANAN_DITERIMA',
            'payment_status' => 'BERHASIL',
            'payment_method' => 'midtrans',
            'subtotal' => 30000,
            'total' => 30000,
            'confirmed_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('payments')->insert([
            'order_id' => $orderId,
            'method' => 'midtrans',
            'status' => 'BERHASIL',
            'amount' => 30000,
            'verified_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('print_jobs')->insert([
            'order_id' => $orderId,
            'document_type' => 'invoice',
            'destination' => 'cashier',
            'status' => 'MENUNGGU',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $response = $this->postJson('/api/v1/cashier/orders/ST-ONLINE-CONFIRM/confirm-online')
            ->assertOk()
            ->assertJsonPath('order.order_status', 'SEDANG_DIBUAT');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'order_status' => 'SEDANG_DIBUAT',
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $orderId,
            'verified_by' => $cashier->id,
        ]);
        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $orderId,
            'status' => 'SELESAI',
        ]);
    }
}
