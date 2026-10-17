<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Bundle;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class MenuController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->where('is_active', true)
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

        $now = now();
        $bundles = Bundle::query()
            ->where('is_active', true)
            ->where(function ($query) use ($now): void {
                $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($query) use ($now): void {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->with(['components.product:id,name,item_type,price,is_available'])
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'slug',
                'description',
                'price',
                'image_path',
                'is_active',
            ]);

        $banners = Banner::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get([
                'id',
                'title',
                'subtitle',
                'image_path',
                'link_url',
            ]);

        return response()->json([
            'categories' => $categories,
            'products' => $products,
            'bundles' => $bundles,
            'banners' => $banners,
        ]);
    }
}
