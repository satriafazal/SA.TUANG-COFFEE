<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoCatalogSeeder extends Seeder
{
    /** Seed only for local UI development; replace with the shop's real catalog. */
    public function run(): void
    {
        // 1. Kategori Induk
        $parentMinuman = Category::updateOrCreate(
            ['slug' => 'minuman'],
            [
                'name' => 'Minuman',
                'parent_id' => null,
                'item_type' => 'drink',
                'sort_order' => 1,
                'is_active' => true,
            ]
        );

        $parentMakanan = Category::updateOrCreate(
            ['slug' => 'makanan'],
            [
                'name' => 'Makanan',
                'parent_id' => null,
                'item_type' => 'food',
                'sort_order' => 2,
                'is_active' => true,
            ]
        );

        // 2. Sub-Kategori
        $subCategoriesData = [
            ['name' => 'Kopi', 'parent_id' => $parentMinuman->id, 'item_type' => 'drink', 'sort_order' => 1],
            ['name' => 'Non-Kopi', 'parent_id' => $parentMinuman->id, 'item_type' => 'drink', 'sort_order' => 2],
            ['name' => 'Makanan Utama (Main Course)', 'parent_id' => $parentMakanan->id, 'item_type' => 'food', 'sort_order' => 1],
            ['name' => 'Camilan (Side Dish)', 'parent_id' => $parentMakanan->id, 'item_type' => 'food', 'sort_order' => 2],
            ['name' => 'Pastry', 'parent_id' => $parentMakanan->id, 'item_type' => 'food', 'sort_order' => 3],
        ];

        $categoryMap = [];
        foreach ($subCategoriesData as $cat) {
            $categoryMap[$cat['name']] = Category::updateOrCreate(
                ['slug' => Str::slug($cat['name'])],
                [
                    'name' => $cat['name'],
                    'parent_id' => $cat['parent_id'],
                    'item_type' => $cat['item_type'],
                    'sort_order' => $cat['sort_order'],
                    'is_active' => true,
                ]
            );
        }

        $catalog = [
            'Kopi' => [
                ['name' => 'Es Kopi Susu', 'description' => 'Espresso, susu, dan gula aren.', 'item_type' => 'drink', 'price' => 22000, 'allow_notes' => true],
                ['name' => 'Americano', 'description' => 'Espresso dengan karakter yang bersih.', 'item_type' => 'drink', 'price' => 18000, 'allow_notes' => true],
            ],
            'Non-Kopi' => [
                ['name' => 'Matcha Latte', 'description' => 'Matcha lembut berpadu dengan susu.', 'item_type' => 'drink', 'price' => 26000, 'allow_notes' => true],
                ['name' => 'Chocolate', 'description' => 'Cokelat hangat dengan rasa pekat.', 'item_type' => 'drink', 'price' => 24000, 'allow_notes' => true],
            ],
            'Makanan Utama (Main Course)' => [
                ['name' => 'Nasi Goreng Sa.tuang', 'description' => 'Nasi goreng rempah khas Sa.tuang dengan telur mata sapi.', 'item_type' => 'food', 'price' => 32000, 'allow_notes' => true],
                ['name' => 'Mie Goreng Spesial', 'description' => 'Mie goreng kenyal dengan racikan bumbu gurih.', 'item_type' => 'food', 'price' => 28000, 'allow_notes' => true],
            ],
            'Camilan (Side Dish)' => [
                ['name' => 'French Fries Garlic', 'description' => 'Kentang goreng renyah dengan taburan bumbu gurih.', 'item_type' => 'food', 'price' => 18000, 'allow_notes' => false],
                ['name' => 'Singkong Goreng Keju', 'description' => 'Singkong goreng empuk renyah dengan parutan keju.', 'item_type' => 'food', 'price' => 16000, 'allow_notes' => false],
            ],
            'Pastry' => [
                ['name' => 'Croissant Butter', 'description' => 'Pastry renyah untuk teman minum kopi.', 'item_type' => 'food', 'price' => 20000, 'allow_notes' => false],
                ['name' => 'Banana Bread', 'description' => 'Roti pisang lembut, dibuat untuk dinikmati santai.', 'item_type' => 'food', 'price' => 18000, 'allow_notes' => false],
            ],
        ];

        foreach ($catalog as $categoryName => $products) {
            $category = $categoryMap[$categoryName] ?? null;
            if (!$category) continue;

            foreach ($products as $product) {
                Product::updateOrCreate(
                    ['slug' => Str::slug($product['name'])],
                    $product + [
                        'category_id' => $category->id,
                        'is_available' => true,
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
