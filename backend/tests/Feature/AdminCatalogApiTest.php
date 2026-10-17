<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_dashboard_and_catalog_endpoints_require_an_active_admin(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();

        $cashier = User::factory()->create(['role' => 'cashier', 'is_active' => true]);
        Sanctum::actingAs($cashier);
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->getJson('/api/v1/admin/categories')->assertForbidden();

        $cashier->update(['role' => 'admin', 'is_active' => false]);
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_admin_can_create_update_and_archive_categories_and_products(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));

        $this->postJson('/api/v1/admin/categories', [
            'name' => 'Kopi Susu',
            'description' => 'Racikan kopi dan susu.',
            'sort_order' => 2,
            'is_active' => true,
        ])->assertCreated()
            ->assertJsonPath('category.slug', 'kopi-susu')
            ->assertJsonPath('category.sort_order', 2);

        $category = Category::query()->firstOrFail();
        $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'Kopi Susu Gula Aren',
            'description' => 'Espresso, susu, gula aren.',
            'item_type' => 'drink',
            'price' => 24000,
            'image_path' => null,
            'allow_notes' => true,
            'is_available' => true,
            'is_active' => true,
        ])->assertCreated()
            ->assertJsonPath('product.slug', 'kopi-susu-gula-aren')
            ->assertJsonPath('product.category.name', 'Kopi Susu');

        $product = Product::query()->firstOrFail();
        $this->putJson('/api/v1/admin/products/'.$product->id, [
            'category_id' => $category->id,
            'name' => 'Kopi Susu Aren',
            'description' => 'Espresso dan susu segar.',
            'item_type' => 'drink',
            'price' => 26000,
            'image_path' => null,
            'allow_notes' => false,
            'is_available' => false,
            'is_active' => true,
        ])->assertOk()
            ->assertJsonPath('product.name', 'Kopi Susu Aren')
            ->assertJsonPath('product.price', '26000.00')
            ->assertJsonPath('product.is_available', false);

        $this->putJson('/api/v1/admin/categories/'.$category->id, [
            'name' => 'Kopi',
            'description' => 'Menu berbasis kopi.',
            'sort_order' => 1,
            'is_active' => false,
        ])->assertOk()
            ->assertJsonPath('category.name', 'Kopi')
            ->assertJsonPath('category.is_active', false);

        $this->assertSame(4, DB::table('audit_logs')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.product.created']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.category.updated']);
    }

    public function test_product_deletion_is_soft_and_category_deletion_is_blocked_while_in_use(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));
        $category = Category::query()->create(['name' => 'Makanan', 'slug' => 'makanan']);
        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Roti Bakar',
            'slug' => 'roti-bakar',
            'item_type' => 'food',
            'price' => 18000,
            'is_available' => true,
            'is_active' => true,
        ]);

        $this->deleteJson('/api/v1/admin/categories/'.$category->id)
            ->assertStatus(409)
            ->assertJsonPath('message', 'Kategori masih digunakan oleh produk. Pindahkan produk terlebih dahulu.');

        $this->deleteJson('/api/v1/admin/products/'.$product->id)->assertNoContent();
        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->getJson('/api/v1/admin/products')->assertOk()->assertJsonCount(0, 'products');

        $this->deleteJson('/api/v1/admin/categories/'.$category->id)->assertNoContent();
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'category_id' => null]);
    }

    public function test_admin_dashboard_reports_catalog_counts(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));
        $activeCategory = Category::query()->create(['name' => 'Minuman', 'slug' => 'minuman', 'is_active' => true]);
        Category::query()->create(['name' => 'Musiman', 'slug' => 'musiman', 'is_active' => false]);
        Product::query()->create([
            'category_id' => $activeCategory->id,
            'name' => 'Es Kopi',
            'slug' => 'es-kopi',
            'item_type' => 'drink',
            'price' => 20000,
            'is_available' => false,
            'is_active' => true,
        ]);
        Product::query()->create([
            'category_id' => $activeCategory->id,
            'name' => 'Kopi Lama',
            'slug' => 'kopi-lama',
            'item_type' => 'drink',
            'price' => 18000,
            'is_available' => true,
            'is_active' => false,
        ]);

        $this->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('stats.active_categories', 1)
            ->assertJsonPath('stats.active_products', 1)
            ->assertJsonPath('stats.unavailable_products', 1)
            ->assertJsonPath('stats.open_orders', 0)
            ->assertJsonCount(0, 'recent_orders');
    }

    public function test_admin_catalog_validation_rejects_invalid_prices_and_product_types(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));
        $category = Category::query()->create(['name' => 'Minuman', 'slug' => 'minuman']);

        $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'Teh',
            'item_type' => 'beverage',
            'price' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['item_type', 'price']);
    }
    public function test_admin_can_upload_product_image(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));

        $file = \Illuminate\Http\UploadedFile::fake()->create('coffee.jpg', 100, 'image/jpeg');

        $response = $this->postJson('/api/v1/admin/upload', [
            'image' => $file,
        ])->assertCreated()
            ->assertJsonStructure(['path', 'url', 'filename']);

        $path = str_replace('/storage/', '', $response->json('path'));
        \Illuminate\Support\Facades\Storage::disk('public')->assertExists($path);
    }

    public function test_admin_can_import_image_from_url(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        \Illuminate\Support\Facades\Http::fake([
            'https://external.com/sample.jpg' => \Illuminate\Support\Facades\Http::response('fake-image-bytes', 200, [
                'Content-Type' => 'image/jpeg',
            ]),
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));

        $response = $this->postJson('/api/v1/admin/import-url', [
            'url' => 'https://external.com/sample.jpg',
        ])->assertCreated()
            ->assertJsonStructure(['path', 'url', 'filename']);

        $path = str_replace('/storage/', '', $response->json('path'));
        \Illuminate\Support\Facades\Storage::disk('public')->assertExists($path);
    }
}

