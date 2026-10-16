<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class MenuController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'sort_order']);

        $products = Product::query()
            ->where('is_active', true)
            ->where('is_available', true)
            ->where(function ($query): void {
                $query->whereNull('category_id')
                    ->orWhereHas('category', fn ($category) => $category->where('is_active', true));
            })
            ->with('category:id,name,slug')
            ->orderBy('name')
            ->get([
                'id',
                'category_id',
                'name',
                'slug',
                'description',
                'item_type',
                'price',
                'image_path',
                'allow_notes',
                'is_available',
            ]);

        return response()->json([
            'categories' => $categories,
            'products' => $products,
        ]);
    }
}
