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

    public function test_cashier_order_queue_excludes_completed_orders(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $active = $this->orderWithItems(['drink']);
        $completed = $this->orderWithItems(['food']);
        DB::table('orders')->where('order_number', $completed)->update(['order_status' => 'SELESAI']);

        $this->getJson('/api/v1/cashier/orders')
            ->assertOk()
            ->assertJsonFragment(['order_number' => $active])
            ->assertJsonMissing(['order_number' => $completed]);

        $this->getJson('/api/v1/cashier/orders/completed')
            ->assertOk()
            ->assertJsonFragment(['order_number' => $completed]);
    }

    public function test_cashier_confirms_cash_payment_and_print_jobs_only_once(): void
    {
        $this->actingAs($this->cashier(), 'sanctum');
        $orderNumber = $this->orderWithItems(['drink']);

        $this->postJson("/api/v1/cashier/orders/{$orderNumber}/confirm-payment")
            ->assertOk()
            ->assertJsonPath('order.payment_status', 'BERHASIL')
            ->assertJsonPath('order.order_status', 'PESANAN_DITERIMA');

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
        $this->assertSame(2, DB::table('order_items')->where('order_id', DB::table('orders')->where('order_number', $orderNumber)->value('id'))->whereIn('item_type', ['food', 'other'])->where('preparation_status', 'MENUNGGU')->count());

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

    public function test_cashier_must_authenticate_and_have_cashier_or_admin_role(): void
    {
        $orderNumber = $this->orderWithItems(['drink']);
        $this->getJson('/api/v1/cashier/orders')->assertUnauthorized();

        $this->actingAs(User::factory()->create(['role' => 'member']), 'sanctum')
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
}
