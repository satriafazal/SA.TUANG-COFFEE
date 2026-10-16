<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_menu_endpoint_returns_active_categories_and_available_products(): void
    {
        $now = now();
        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Kopi',
            'slug' => 'kopi',
            'sort_order' => 1,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('products')->insert([
            [
                'category_id' => $categoryId,
                'name' => 'Es Kopi Susu',
                'slug' => 'es-kopi-susu',
                'item_type' => 'drink',
                'price' => 22000,
                'is_available' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'category_id' => $categoryId,
                'name' => 'Menu Habis',
                'slug' => 'menu-habis',
                'item_type' => 'drink',
                'price' => 18000,
                'is_available' => false,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $this->getJson('/api/v1/menu')
            ->assertOk()
            ->assertJsonPath('categories.0.slug', 'kopi')
            ->assertJsonCount(1, 'products')
            ->assertJsonPath('products.0.slug', 'es-kopi-susu')
            ->assertJsonPath('products.0.price', '22000.00');
    }
}
