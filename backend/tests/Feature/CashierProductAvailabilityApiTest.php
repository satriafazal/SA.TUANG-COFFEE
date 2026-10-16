<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CashierProductAvailabilityApiTest extends TestCase
{
    use RefreshDatabase;

    private function product(bool $available = true): int
    {
        return DB::table('products')->insertGetId([
            'name' => 'Kopi Uji',
            'slug' => 'kopi-uji',
            'item_type' => 'drink',
            'price' => 25000,
            'allow_notes' => false,
            'is_available' => $available,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_cashier_can_list_and_update_product_availability(): void
    {
        $cashier = User::factory()->create(['role' => 'cashier', 'is_active' => true]);
        $this->assertSame('cashier', $cashier->role);
        $this->assertTrue($cashier->is_active);
        $this->actingAs($cashier, 'sanctum');
        $productId = $this->product();

        $this->getJson('/api/v1/cashier/products')
            ->assertOk()
            ->assertJsonPath('products.0.id', $productId)
            ->assertJsonPath('products.0.is_available', true);

        $this->patchJson("/api/v1/cashier/products/{$productId}/availability", ['is_available' => false])
            ->assertOk()
            ->assertJsonPath('product.id', $productId)
            ->assertJsonPath('product.is_available', false);

        $this->assertDatabaseHas('products', ['id' => $productId, 'is_available' => false]);
        $this->getJson('/api/v1/menu')->assertJsonMissing(['id' => $productId]);
    }

    public function test_product_availability_endpoints_require_cashier_or_admin_role(): void
    {
        $productId = $this->product();
        $this->getJson('/api/v1/cashier/products')->assertUnauthorized();

        $this->actingAs(User::factory()->create(['role' => 'member']), 'sanctum')
            ->patchJson("/api/v1/cashier/products/{$productId}/availability", ['is_available' => false])
            ->assertForbidden();
    }
}
