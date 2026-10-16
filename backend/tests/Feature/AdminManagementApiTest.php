<?php

namespace Tests\Feature;

use App\Models\Bundle;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManagementApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);
        $this->adminToken = $this->admin->createToken('admin-test')->plainTextToken;
    }

    public function test_admin_can_manage_bundles(): void
    {
        $category = Category::query()->create([
            'name' => 'Minuman Kopi',
            'slug' => 'minuman-kopi',
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $p1 = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Kopi Tubruk',
            'slug' => 'kopi-tubruk',
            'item_type' => 'drink',
            'price' => 15000,
            'is_available' => true,
            'is_active' => true,
        ]);

        $p2 = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Roti Bakar',
            'slug' => 'roti-bakar',
            'item_type' => 'food',
            'price' => 20000,
            'is_available' => true,
            'is_active' => true,
        ]);

        // Create bundle
        $response = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->postJson('/api/v1/admin/bundles', [
                'name' => 'Paket Sarapan Hemat',
                'description' => 'Kopi dan roti bakar lezat',
                'price' => 30000,
                'components' => [
                    ['product_id' => $p1->id, 'quantity' => 1],
                    ['product_id' => $p2->id, 'quantity' => 2],
                ],
            ]);

        $response->assertCreated()
            ->assertJsonPath('bundle.name', 'Paket Sarapan Hemat')
            ->assertJsonCount(2, 'bundle.products');

        $bundleId = $response->json('bundle.id');

        // List bundles
        $listResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->getJson('/api/v1/admin/bundles');
        $listResponse->assertOk()
            ->assertJsonCount(1, 'bundles');

        // Update bundle
        $updateResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->putJson("/api/v1/admin/bundles/{$bundleId}", [
                'name' => 'Paket Sarapan Jumbo',
                'price' => 32000,
                'components' => [
                    ['product_id' => $p1->id, 'quantity' => 2],
                ],
            ]);
        $updateResponse->assertOk()
            ->assertJsonPath('bundle.name', 'Paket Sarapan Jumbo')
            ->assertJsonCount(1, 'bundle.products');

        // Delete bundle
        $deleteResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->deleteJson("/api/v1/admin/bundles/{$bundleId}");
        $deleteResponse->assertNoContent();
        $this->assertDatabaseMissing('bundles', ['id' => $bundleId]);
    }

    public function test_admin_can_manage_promotions(): void
    {
        // Create promotion
        $response = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->postJson('/api/v1/admin/promotions', [
                'code' => 'SATUANGHEMAT',
                'name' => 'Diskon 10%',
                'discount_type' => 'percent',
                'discount_value' => 10,
                'min_spend' => 50000,
                'max_discount' => 15000,
            ]);
        $response->assertCreated()
            ->assertJsonPath('promotion.code', 'SATUANGHEMAT');

        $promoId = $response->json('promotion.id');

        // List promotions
        $listResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->getJson('/api/v1/admin/promotions');
        $listResponse->assertOk()
            ->assertJsonCount(1, 'promotions');

        // Update
        $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->putJson("/api/v1/admin/promotions/{$promoId}", [
                'code' => 'SATUANGSUPER',
                'name' => 'Diskon 15%',
                'discount_type' => 'percent',
                'discount_value' => 15,
                'min_spend' => 60000,
            ])
            ->assertOk()
            ->assertJsonPath('promotion.code', 'SATUANGSUPER');

        // Delete
        $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->deleteJson("/api/v1/admin/promotions/{$promoId}")
            ->assertNoContent();
    }

    public function test_admin_can_manage_banners(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->postJson('/api/v1/admin/banners', [
                'title' => 'Promo Spesial Grand Opening',
                'subtitle' => 'Dapatkan potongan 20% untuk menu kopi pilihan',
                'sort_order' => 1,
            ]);
        $response->assertCreated()
            ->assertJsonPath('banner.title', 'Promo Spesial Grand Opening');

        $bannerId = $response->json('banner.id');

        $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->getJson('/api/v1/admin/banners')
            ->assertOk()
            ->assertJsonCount(1, 'banners');

        $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->deleteJson("/api/v1/admin/banners/{$bannerId}")
            ->assertNoContent();
    }

    public function test_admin_can_manage_staff(): void
    {
        // Create staff cashier
        $response = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->postJson('/api/v1/admin/staff', [
                'name' => 'Kasir Sore',
                'email' => 'kasir.sore@satuang.test',
                'password' => 'PasswordSangatAman123!',
                'role' => 'cashier',
            ]);
        $response->assertCreated()
            ->assertJsonPath('staff.name', 'Kasir Sore')
            ->assertJsonPath('staff.role', 'cashier')
            ->assertJsonPath('staff.is_active', true);

        $staffId = $response->json('staff.id');

        // Toggle status
        $toggleResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->patchJson("/api/v1/admin/staff/{$staffId}/toggle-status");
        $toggleResponse->assertOk()
            ->assertJsonPath('staff.is_active', false);

        // Prevent self deactivation
        $selfToggle = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->patchJson("/api/v1/admin/staff/{$this->admin->id}/toggle-status");
        $selfToggle->assertBadRequest();

        // Update staff
        $updateResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->putJson("/api/v1/admin/staff/{$staffId}", [
                'name' => 'Kasir Utama Sore',
                'email' => 'kasir.sore@satuang.test',
                'role' => 'cashier',
                'is_active' => true,
            ]);
        $updateResponse->assertOk()
            ->assertJsonPath('staff.name', 'Kasir Utama Sore')
            ->assertJsonPath('staff.is_active', true);
    }

    public function test_admin_can_query_orders_and_audit_logs(): void
    {
        // Make an order directly
        Order::query()->create([
            'order_number' => 'ORD-12345',
            'customer_name' => 'Budi Santoso',
            'order_status' => 'SEDANG_DIBUAT',
            'payment_status' => 'BERHASIL',
            'payment_method' => 'cash',
            'subtotal' => 25000,
            'total' => 25000,
        ]);

        $ordersResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->getJson('/api/v1/admin/orders?q=Budi');
        $ordersResponse->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.order_number', 'ORD-12345');

        // Make an audit log entry by creating category
        $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->postJson('/api/v1/admin/categories', ['name' => 'Espresso Based']);

        $auditResponse = $this->withHeader('Authorization', "Bearer {$this->adminToken}")
            ->getJson('/api/v1/admin/audit-logs');
        $auditResponse->assertOk()
            ->assertJsonPath('audit_logs.0.action', 'admin.category.created')
            ->assertJsonPath('audit_logs.0.actor_name', $this->admin->name);
    }
}
