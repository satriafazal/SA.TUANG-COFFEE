<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use App\Services\Loyalty\LoyaltyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LoyaltyAndPromotionApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Customer $member;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->member = Customer::create([
            'name' => 'Budi Member',
            'phone' => '081234567890',
            'email' => 'budi@example.com',
            'password' => 'secret1234',
            'points_balance' => 50,
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Kopi',
            'slug' => 'kopi',
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $category->id,
            'name' => 'Kopi Latte',
            'slug' => 'kopi-latte',
            'item_type' => 'drink',
            'price' => 35000,
            'is_active' => true,
            'is_available' => true,
        ]);
    }

    public function test_admin_can_view_default_and_updated_loyalty_settings(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->getJson('/api/v1/admin/loyalty/settings');

        $res->assertOk()
            ->assertJsonPath('settings.is_active', true)
            ->assertJsonPath('settings.earning_threshold', 10000)
            ->assertJsonPath('settings.point_value_rupiah', 500)
            ->assertJsonPath('settings.min_redemption_points', 5)
            ->assertJsonPath('settings.max_discount_percentage', 50);

        // Update settings
        $updateRes = $this->putJson('/api/v1/admin/loyalty/settings', [
            'is_active' => true,
            'earning_threshold' => 15000,
            'point_value_rupiah' => 750,
            'min_redemption_points' => 10,
            'max_discount_percentage' => 40,
        ]);

        $updateRes->assertOk()
            ->assertJsonPath('settings.earning_threshold', 15000)
            ->assertJsonPath('settings.point_value_rupiah', 750)
            ->assertJsonPath('settings.min_redemption_points', 10)
            ->assertJsonPath('settings.max_discount_percentage', 40);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'admin.loyalty.updated',
            'actor_id' => $this->admin->id,
        ]);
    }

    public function test_public_can_view_loyalty_settings(): void
    {
        $res = $this->getJson('/api/v1/loyalty/settings');
        $res->assertOk()
            ->assertJsonStructure(['settings' => [
                'is_active',
                'earning_threshold',
                'point_value_rupiah',
                'min_redemption_points',
                'max_discount_percentage',
            ]]);
    }

    public function test_member_can_redeem_points_for_order_discount(): void
    {
        Sanctum::actingAs($this->member);

        // Member has 50 points. Subtotal is 35.000.
        // Redeem 10 points = 10 * 500 = Rp 5.000 discount. Total = Rp 30.000.
        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Budi Member',
            'customer_phone' => '081234567890',
            'payment_method' => 'cash',
            'points_redeemed' => 10,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $res->assertCreated();
        $this->assertEquals(35000, (float) $res->json('order.subtotal'));
        $this->assertEquals(5000, (float) $res->json('order.points_discount'));
        $this->assertEquals(30000, (float) $res->json('order.total'));
        $this->assertEquals(10, $res->json('order.points_redeemed'));

        // Member balance should be 50 - 10 = 40
        $this->assertEquals(40, $this->member->fresh()->points_balance);
    }

    public function test_cannot_combine_loyalty_points_and_promo_voucher(): void
    {
        Sanctum::actingAs($this->member);

        Promotion::create([
            'code' => 'HEMAT10',
            'name' => 'Diskon 10%',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'min_spend' => 10000,
            'is_active' => true,
        ]);

        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Budi Member',
            'customer_phone' => '081234567890',
            'payment_method' => 'cash',
            'promo_code' => 'HEMAT10',
            'points_redeemed' => 10,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['points_redeemed']);
    }

    public function test_guest_cannot_redeem_loyalty_points(): void
    {
        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Guest User',
            'customer_phone' => '0899999999',
            'payment_method' => 'cash',
            'points_redeemed' => 10,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['points_redeemed']);
    }

    public function test_member_cannot_redeem_more_points_than_balance(): void
    {
        Sanctum::actingAs($this->member);

        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Budi Member',
            'payment_method' => 'cash',
            'points_redeemed' => 100, // Member only has 50
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['points_redeemed']);
    }

    public function test_promo_dates_validation_rejects_expired_or_future_promos(): void
    {
        Promotion::create([
            'code' => 'EXPIRED',
            'name' => 'Promo Kemarin',
            'discount_type' => 'fixed',
            'discount_value' => 5000,
            'min_spend' => 10000,
            'is_active' => true,
            'starts_at' => now()->subDays(5),
            'ends_at' => now()->subDay(),
        ]);

        Promotion::create([
            'code' => 'FUTURE',
            'name' => 'Promo Besok',
            'discount_type' => 'fixed',
            'discount_value' => 5000,
            'min_spend' => 10000,
            'is_active' => true,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(5),
        ]);

        // Validate API
        $this->postJson('/api/v1/promotions/validate', [
            'code' => 'EXPIRED',
            'subtotal' => 35000,
        ])->assertStatus(422);

        $this->postJson('/api/v1/promotions/validate', [
            'code' => 'FUTURE',
            'subtotal' => 35000,
        ])->assertStatus(422);

        // Checkout API with expired promo
        $this->postJson('/api/v1/orders', [
            'customer_name' => 'Guest User',
            'payment_method' => 'cash',
            'promo_code' => 'EXPIRED',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1],
            ],
        ])->assertStatus(422);
    }

    public function test_admin_cannot_set_point_value_greater_than_or_equal_to_threshold(): void
    {
        Sanctum::actingAs($this->admin);

        // point_value equal to threshold (100% loss)
        $res = $this->putJson('/api/v1/admin/loyalty/settings', [
            'is_active' => true,
            'earning_threshold' => 10000,
            'point_value_rupiah' => 10000,
            'min_redemption_points' => 5,
            'max_discount_percentage' => 50,
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['point_value_rupiah']);

        // point_value greater than threshold (> 100% loss)
        $res2 = $this->putJson('/api/v1/admin/loyalty/settings', [
            'is_active' => true,
            'earning_threshold' => 10000,
            'point_value_rupiah' => 15000,
            'min_redemption_points' => 5,
            'max_discount_percentage' => 50,
        ]);

        $res2->assertStatus(422)
            ->assertJsonValidationErrors(['point_value_rupiah']);
    }

    public function test_customer_redeemed_points_are_refunded_when_unpaid_order_expires(): void
    {
        Sanctum::actingAs($this->member);

        $initialBalance = $this->member->points_balance; // 50
        $redeemPoints = 10;

        // Create order with 10 points redeemed
        $res = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Budi Member',
            'payment_method' => 'cash',
            'points_redeemed' => $redeemPoints,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1],
            ],
        ]);

        $res->assertCreated();
        $orderNumber = $res->json('order.order_number');

        // Verify balance was decremented
        $this->assertEquals($initialBalance - $redeemPoints, $this->member->fresh()->points_balance);

        // Fast-forward order to be expired
        $order = Order::where('order_number', $orderNumber)->firstOrFail();
        $order->update(['expires_at' => now()->subMinutes(15)]);

        // Trigger expiration via expirePendingOrders
        Order::expirePendingOrders();

        $order->refresh();
        $this->assertEquals('DIBATALKAN', $order->order_status);

        // Verify balance was refunded
        $this->assertEquals($initialBalance, $this->member->fresh()->points_balance);

        // Verify calling again does not refund again (idempotent)
        $order->refundRedeemedPointsIfCancelled();
        $this->assertEquals($initialBalance, $this->member->fresh()->points_balance);
    }
}
