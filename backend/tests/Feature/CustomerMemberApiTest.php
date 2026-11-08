<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerMemberApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_as_member_with_phone_and_password(): void
    {
        $response = $this->postJson('/api/v1/members/register', [
            'name' => 'Satria Customer',
            'email' => 'satria@example.com',
            'phone' => '081234567890',
            'password' => 'secret1234',
            'password_confirmation' => 'secret1234',
        ]);

        $response->assertCreated()
            ->assertJsonPath('customer.name', 'Satria Customer')
            ->assertJsonPath('customer.email', 'satria@example.com')
            ->assertJsonPath('customer.phone', '081234567890')
            ->assertJsonPath('customer.points_balance', 0)
            ->assertJsonStructure(['token', 'customer']);

        $this->assertDatabaseHas('customers', [
            'email' => 'satria@example.com',
            'phone' => '081234567890',
        ]);
    }

    public function test_member_registration_rejects_duplicate_phone_or_short_password(): void
    {
        Customer::create([
            'name' => 'Existing Member',
            'email' => 'existing@example.com',
            'phone' => '08111222333',
            'password' => 'password123',
            'points_balance' => 0,
        ]);

        $dupPhone = $this->postJson('/api/v1/members/register', [
            'name' => 'Another Satria',
            'email' => 'another@example.com',
            'phone' => '08111222333',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);
        $dupPhone->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);

        $shortPass = $this->postJson('/api/v1/members/register', [
            'name' => 'Short Pass',
            'email' => 'short@example.com',
            'phone' => '08999888777',
            'password' => '1234',
            'password_confirmation' => '1234',
        ]);
        $shortPass->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_member_can_login_with_email_or_phone(): void
    {
        Customer::create([
            'name' => 'Member Satuang',
            'email' => 'member@satuang.test',
            'phone' => '085566778899',
            'password' => 'kopisatuang88',
            'points_balance' => 50,
        ]);

        // Login with email
        $resEmail = $this->postJson('/api/v1/members/login', [
            'identifier' => 'member@satuang.test',
            'password' => 'kopisatuang88',
        ]);
        $resEmail->assertOk()
            ->assertJsonPath('customer.points_balance', 50);

        // Login with phone
        $resPhone = $this->postJson('/api/v1/members/login', [
            'identifier' => '085566778899',
            'password' => 'kopisatuang88',
        ]);
        $resPhone->assertOk()
            ->assertJsonPath('customer.email', 'member@satuang.test');
    }

    public function test_order_creates_daily_ticket_and_blocks_device_spam(): void
    {
        $category = Category::create(['name' => 'Coffee', 'slug' => 'coffee', 'sort_order' => 1]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Kopi Susu Sa.Tuang',
            'slug' => 'kopi-susu-sa-tuang',
            'item_type' => 'drink',
            'price' => '20000.00',
            'is_active' => true,
            'is_available' => true,
        ]);

        $deviceToken = 'device-uuid-test-12345';

        // First order: OK
        $res1 = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Satria',
            'guest_device_token' => $deviceToken,
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $res1->assertCreated()
            ->assertJsonPath('order.daily_ticket_number', '#001');

        $this->assertDatabaseHas('orders', [
            'daily_ticket_number' => '#001',
            'guest_device_token' => $deviceToken,
        ]);

        // Second order with same device token while pending: Rejected with 422
        $res2 = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Satria Iseng',
            'guest_device_token' => $deviceToken,
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $res2->assertStatus(422)
            ->assertJsonValidationErrors(['items']);

        // Check my-orders returns the order
        $resOrders = $this->getJson("/api/v1/orders/my-orders?device_token={$deviceToken}");
        $resOrders->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.daily_ticket_number', '#001');
    }

    public function test_guest_my_orders_excludes_orders_from_yesterday(): void
    {
        $category = Category::create(['name' => 'Signature', 'slug' => 'signature', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Kopi Tuang',
            'slug' => 'kopi-tuang-yesterday',
            'item_type' => 'drink',
            'price' => '22000.00',
            'is_active' => true,
            'is_available' => true,
        ]);

        $deviceToken = 'dev-token-daily-test';

        // Order created yesterday
        $yesterdayOrder = Order::create([
            'order_number' => 'ST-261102-ABC123',
            'daily_ticket_number' => '#005',
            'customer_name' => 'Guest Yesterday',
            'guest_device_token' => $deviceToken,
            'subtotal' => '22000.00',
            'total' => '22000.00',
            'payment_method' => 'cash',
            'payment_status' => 'LUNAS',
            'order_status' => 'SELESAI',
        ]);
        $yesterdayOrder->created_at = now()->subDays(2);
        $yesterdayOrder->saveQuietly();

        // my-orders for guest device should not include yesterday's order
        $resOrders = $this->getJson("/api/v1/orders/my-orders?device_token={$deviceToken}");
        $resOrders->assertOk()
            ->assertJsonCount(0, 'orders');

        // Order created today
        $todayOrder = Order::create([
            'order_number' => 'ST-261103-DEF456',
            'daily_ticket_number' => '#001',
            'customer_name' => 'Guest Today',
            'guest_device_token' => $deviceToken,
            'subtotal' => '22000.00',
            'total' => '22000.00',
            'payment_method' => 'cash',
            'payment_status' => 'MENUNGGU',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Now my-orders returns today's order only
        $resOrders2 = $this->getJson("/api/v1/orders/my-orders?device_token={$deviceToken}");
        $resOrders2->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.order_number', 'ST-261103-DEF456');
    }

    public function test_guest_can_order_today_even_if_yesterday_had_pending_order(): void
    {
        $category = Category::create(['name' => 'Kopi', 'slug' => 'kopi-pending', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Latte',
            'slug' => 'latte-pending',
            'item_type' => 'drink',
            'price' => '25000.00',
            'is_active' => true,
            'is_available' => true,
        ]);

        $deviceToken = 'dev-pending-yesterday';

        // Yesterday order left unpaid/pending
        $yesterdayPending = Order::create([
            'order_number' => 'ST-261102-PEND01',
            'daily_ticket_number' => '#099',
            'customer_name' => 'Unpaid Guest',
            'guest_device_token' => $deviceToken,
            'subtotal' => '25000.00',
            'total' => '25000.00',
            'payment_method' => 'cash',
            'payment_status' => 'MENUNGGU',
            'order_status' => 'MENUNGGU_PEMBAYARAN',
        ]);
        $yesterdayPending->created_at = now()->subDays(2);
        $yesterdayPending->saveQuietly();

        // Today guest places a new order: should NOT be blocked by yesterday's pending order
        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Fresh Guest Today',
            'guest_device_token' => $deviceToken,
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $res->assertCreated()
            ->assertJsonPath('order.customer_name', 'Fresh Guest Today');
    }
}
