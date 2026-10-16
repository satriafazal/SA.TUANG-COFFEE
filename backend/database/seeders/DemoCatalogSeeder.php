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
        $catalog = [
            'Kopi' => [
                ['name' => 'Es Kopi Susu', 'description' => 'Espresso, susu, dan gula aren.', 'item_type' => 'drink', 'price' => 22000, 'allow_notes' => true],
                ['name' => 'Americano', 'description' => 'Espresso dengan karakter yang bersih.', 'item_type' => 'drink', 'price' => 18000, 'allow_notes' => true],
            ],
            'Non-Kopi' => [
                ['name' => 'Matcha Latte', 'description' => 'Matcha lembut berpadu dengan susu.', 'item_type' => 'drink', 'price' => 26000, 'allow_notes' => true],
                ['name' => 'Chocolate', 'description' => 'Cokelat hangat dengan rasa pekat.', 'item_type' => 'drink', 'price' => 24000, 'allow_notes' => true],
            ],
            'Teman Ngopi' => [
                ['name' => 'Croissant Butter', 'description' => 'Pastry renyah untuk teman minum kopi.', 'item_type' => 'food', 'price' => 20000, 'allow_notes' => false],
                ['name' => 'Banana Bread', 'description' => 'Roti pisang lembut, dibuat untuk dinikmati santai.', 'item_type' => 'food', 'price' => 18000, 'allow_notes' => false],
            ],
        ];

        foreach ($catalog as $categoryName => $products) {
            $category = Category::updateOrCreate(
                ['slug' => Str::slug($categoryName)],
                ['name' => $categoryName, 'is_active' => true]
            );

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
