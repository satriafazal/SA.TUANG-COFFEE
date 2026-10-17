<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Bundle;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class AdminCatalogController extends Controller
{
    public function dashboard(): JsonResponse
    {
        return response()->json([
            'stats' => [
                'active_categories' => Category::query()->where('is_active', true)->count(),
                'active_products' => Product::query()->where('is_active', true)->count(),
                'unavailable_products' => Product::query()->where('is_active', true)->where('is_available', false)->count(),
                'active_bundles' => Bundle::query()->where('is_active', true)->count(),
                'active_promotions' => Promotion::query()->where('is_active', true)->count(),
                'active_staff' => User::query()->whereIn('role', ['admin', 'cashier'])->where('is_active', true)->count(),
                'open_orders' => Order::query()->whereIn('order_status', [
                    'MENUNGGU_PEMBAYARAN', 'PESANAN_DITERIMA', 'SEDANG_DIBUAT', 'SIAP_DIAMBIL',
                ])->count(),
            ],
            'recent_orders' => Order::query()
                ->latest()
                ->limit(6)
                ->get(['order_number', 'customer_name', 'order_status', 'payment_status', 'total', 'created_at']),
        ]);
    }

    /* -------------------------------------------------------------------------- */
    /* Categories                                                                 */
    /* -------------------------------------------------------------------------- */

    public function categories(): JsonResponse
    {
        $categories = Category::query()
            ->withCount('products')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['categories' => $categories]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $data['description'] ??= null;
        $data['sort_order'] ??= 0;
        $data['is_active'] ??= true;
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? null, $data['name'], Category::class);

        $category = DB::transaction(function () use ($request, $data): Category {
            $category = Category::query()->create($data);
            $this->audit($request, 'admin.category.created', $category, null, $category->getAttributes());

            return $category;
        }, 3);

        return response()->json(['category' => $category->loadCount('products')], 201);
    }

    public function updateCategory(Request $request, int $categoryId): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category = DB::transaction(function () use ($request, $data, $categoryId): Category {
            $category = Category::query()->lockForUpdate()->findOrFail($categoryId);
            $before = $category->getAttributes();
            if (array_key_exists('slug', $data) && $data['slug'] !== null) {
                $data['slug'] = $this->uniqueSlug($data['slug'], $data['name'], Category::class, $category->id);
            }
            $category->update($data);
            $this->audit($request, 'admin.category.updated', $category, $before, $category->fresh()->getAttributes());

            return $category->fresh()->loadCount('products');
        }, 3);

        return response()->json(['category' => $category]);
    }

    public function destroyCategory(Request $request, int $categoryId): JsonResponse
    {
        DB::transaction(function () use ($request, $categoryId): void {
            $category = Category::query()->lockForUpdate()->findOrFail($categoryId);
            if ($category->products()->exists()) {
                throw new ConflictHttpException('Kategori masih digunakan oleh produk. Pindahkan produk terlebih dahulu.');
            }
            $before = $category->getAttributes();
            $category->delete();
            $this->audit($request, 'admin.category.deleted', $category, $before, null);
        }, 3);

        return response()->json([], 204);
    }

    /* -------------------------------------------------------------------------- */
    /* Products                                                                   */
    /* -------------------------------------------------------------------------- */

    public function products(): JsonResponse
    {
        $products = Product::query()
            ->with('category:id,name,slug,sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['products' => $products]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $data = $request->validate($this->productRules());
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? null, $data['name'], Product::class);
        $data['allow_notes'] = $data['allow_notes'] ?? false;
        $data['is_available'] = $data['is_available'] ?? true;
        $data['is_active'] = $data['is_active'] ?? true;

        $product = DB::transaction(function () use ($request, $data): Product {
            $product = Product::query()->create($data);
            $this->audit($request, 'admin.product.created', $product, null, $product->getAttributes());

            return $product->load('category:id,name,slug,sort_order');
        }, 3);

        return response()->json(['product' => $product], 201);
    }

    public function updateProduct(Request $request, int $productId): JsonResponse
    {
        $data = $request->validate($this->productRules());
        $product = DB::transaction(function () use ($request, $data, $productId): Product {
            $product = Product::query()->lockForUpdate()->findOrFail($productId);
            $before = $product->getAttributes();
            if (array_key_exists('slug', $data) && $data['slug'] !== null) {
                $data['slug'] = $this->uniqueSlug($data['slug'], $data['name'], Product::class, $product->id);
            }
            $product->update($data);
            $this->audit($request, 'admin.product.updated', $product, $before, $product->fresh()->getAttributes());

            return $product->fresh()->load('category:id,name,slug,sort_order');
        }, 3);

        return response()->json(['product' => $product]);
    }

    public function destroyProduct(Request $request, int $productId): JsonResponse
    {
        DB::transaction(function () use ($request, $productId): void {
            $product = Product::query()->lockForUpdate()->findOrFail($productId);
            $before = $product->getAttributes();
            $product->delete();
            $this->audit($request, 'admin.product.deleted', $product, $before, $product->getAttributes());
        }, 3);

        return response()->json([], 204);
    }

    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'mimes:jpeg,png,jpg,webp,gif,bmp,jfif,avif', 'max:10240'],
        ]);

        $file = $request->file('image');
        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = Str::random(24) . '.' . strtolower($extension);
        $path = $file->storeAs('products', $filename, 'public');

        return response()->json([
            'path' => '/storage/' . $path,
            'url' => asset('storage/' . $path),
            'filename' => $filename,
        ], 201);
    }

    public function importImageUrl(Request $request): JsonResponse
    {
        $data = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
        ]);

        $url = $data['url'];
        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (!in_array(strtolower($scheme ?? ''), ['http', 'https'], true)) {
            return response()->json([
                'message' => 'Protokol URL tidak didukung. Gunakan HTTP atau HTTPS.',
            ], 422);
        }

        try {
            $response = Http::timeout(15)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; SATUANG-Catalog-Importer/1.0)',
                    'Accept' => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                ])
                ->get($url);

            if (!$response->successful()) {
                return response()->json([
                    'message' => "Gagal mengunduh gambar dari URL eksternal (status {$response->status()}).",
                ], 422);
            }

            $contentType = strtolower($response->header('Content-Type') ?? '');
            $validTypes = [
                'image/jpeg' => 'jpg',
                'image/jpg'  => 'jpg',
                'image/png'  => 'png',
                'image/webp' => 'webp',
                'image/gif'  => 'gif',
                'image/avif' => 'avif',
            ];

            $extension = null;
            foreach ($validTypes as $mime => $ext) {
                if (str_contains($contentType, $mime)) {
                    $extension = $ext;
                    break;
                }
            }

            if (!$extension) {
                $path = parse_url($url, PHP_URL_PATH);
                $pathExt = strtolower(pathinfo($path ?? '', PATHINFO_EXTENSION));
                if (in_array($pathExt, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'], true)) {
                    $extension = $pathExt === 'jpeg' ? 'jpg' : $pathExt;
                }
            }

            if (!$extension) {
                return response()->json([
                    'message' => 'Konten dari URL bukan format gambar yang didukung (JPG, PNG, WEBP, GIF).',
                ], 422);
            }

            $body = $response->body();
            if (strlen($body) > 10 * 1024 * 1024) {
                return response()->json([
                    'message' => 'Ukuran gambar dari URL melebihi batas 10MB.',
                ], 422);
            }

            $filename = Str::random(24) . '.' . $extension;
            Storage::disk('public')->put('products/' . $filename, $body);

            return response()->json([
                'path' => '/storage/products/' . $filename,
                'url' => asset('storage/products/' . $filename),
                'filename' => $filename,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Gagal mengambil gambar dari URL: ' . $e->getMessage(),
            ], 422);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* Bundles (Menu Paket)                                                       */
    /* -------------------------------------------------------------------------- */

    public function bundles(): JsonResponse
    {
        $bundles = Bundle::query()
            ->with(['products' => function ($query) {
                $query->select('products.id', 'products.name', 'products.price', 'products.item_type', 'products.is_available');
            }])
            ->orderBy('name')
            ->get();

        return response()->json(['bundles' => $bundles]);
    }

    public function storeBundle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'components' => ['required', 'array', 'min:1'],
            'components.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'components.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $data['slug'] = $this->uniqueSlug($data['slug'] ?? null, $data['name'], Bundle::class);
        $data['is_active'] = $data['is_active'] ?? true;
        $components = $data['components'];
        unset($data['components']);

        $bundle = DB::transaction(function () use ($request, $data, $components): Bundle {
            $bundle = Bundle::query()->create($data);

            $syncData = [];
            foreach ($components as $component) {
                $syncData[$component['product_id']] = ['quantity' => $component['quantity']];
            }
            $bundle->products()->sync($syncData);

            $this->audit($request, 'admin.bundle.created', $bundle, null, [
                'bundle' => $bundle->getAttributes(),
                'components' => $syncData,
            ]);

            return $bundle->load('products');
        }, 3);

        return response()->json(['bundle' => $bundle], 201);
    }

    public function updateBundle(Request $request, int $bundleId): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'components' => ['required', 'array', 'min:1'],
            'components.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'components.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $bundle = DB::transaction(function () use ($request, $data, $bundleId): Bundle {
            $bundle = Bundle::query()->lockForUpdate()->findOrFail($bundleId);
            $before = $bundle->getAttributes();
            if (array_key_exists('slug', $data) && $data['slug'] !== null) {
                $data['slug'] = $this->uniqueSlug($data['slug'], $data['name'], Bundle::class, $bundle->id);
            }
            $components = $data['components'];
            unset($data['components']);

            $bundle->update($data);

            $syncData = [];
            foreach ($components as $component) {
                $syncData[$component['product_id']] = ['quantity' => $component['quantity']];
            }
            $bundle->products()->sync($syncData);

            $this->audit($request, 'admin.bundle.updated', $bundle, $before, [
                'bundle' => $bundle->fresh()->getAttributes(),
                'components' => $syncData,
            ]);

            return $bundle->fresh()->load('products');
        }, 3);

        return response()->json(['bundle' => $bundle]);
    }

    public function destroyBundle(Request $request, int $bundleId): JsonResponse
    {
        DB::transaction(function () use ($request, $bundleId): void {
            $bundle = Bundle::query()->lockForUpdate()->findOrFail($bundleId);
            $before = $bundle->getAttributes();
            $bundle->products()->detach();
            $bundle->delete();
            $this->audit($request, 'admin.bundle.deleted', $bundle, $before, null);
        }, 3);

        return response()->json([], 204);
    }

    /* -------------------------------------------------------------------------- */
    /* Promotions (Promo & Voucher)                                               */
    /* -------------------------------------------------------------------------- */

    public function promotions(): JsonResponse
    {
        $promotions = Promotion::query()
            ->orderBy('is_active', 'desc')
            ->orderBy('code')
            ->get();

        return response()->json(['promotions' => $promotions]);
    }

    public function storePromotion(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:promotions,code'],
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'discount_type' => ['required', 'string', 'in:fixed,percent'],
            'discount_value' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'min_spend' => ['sometimes', 'numeric', 'min:0'],
            'max_discount' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        $data['code'] = strtoupper(trim($data['code']));
        $data['is_active'] = $data['is_active'] ?? true;
        $data['min_spend'] = $data['min_spend'] ?? 0;

        $promotion = DB::transaction(function () use ($request, $data): Promotion {
            $promotion = Promotion::query()->create($data);
            $this->audit($request, 'admin.promotion.created', $promotion, null, $promotion->getAttributes());

            return $promotion;
        }, 3);

        return response()->json(['promotion' => $promotion], 201);
    }

    public function updatePromotion(Request $request, int $promotionId): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('promotions', 'code')->ignore($promotionId)],
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'discount_type' => ['required', 'string', 'in:fixed,percent'],
            'discount_value' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'min_spend' => ['sometimes', 'numeric', 'min:0'],
            'max_discount' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        $data['code'] = strtoupper(trim($data['code']));

        $promotion = DB::transaction(function () use ($request, $data, $promotionId): Promotion {
            $promotion = Promotion::query()->lockForUpdate()->findOrFail($promotionId);
            $before = $promotion->getAttributes();
            $promotion->update($data);
            $this->audit($request, 'admin.promotion.updated', $promotion, $before, $promotion->fresh()->getAttributes());

            return $promotion->fresh();
        }, 3);

        return response()->json(['promotion' => $promotion]);
    }

    public function destroyPromotion(Request $request, int $promotionId): JsonResponse
    {
        DB::transaction(function () use ($request, $promotionId): void {
            $promotion = Promotion::query()->lockForUpdate()->findOrFail($promotionId);
            $before = $promotion->getAttributes();
            $promotion->delete();
            $this->audit($request, 'admin.promotion.deleted', $promotion, $before, null);
        }, 3);

        return response()->json([], 204);
    }

    /* -------------------------------------------------------------------------- */
    /* Banners & Store Info                                                       */
    /* -------------------------------------------------------------------------- */

    public function banners(): JsonResponse
    {
        $banners = Banner::query()
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['banners' => $banners]);
    }

    public function storeBanner(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'link_url' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $data['sort_order'] ??= 0;
        $data['is_active'] ??= true;

        $banner = DB::transaction(function () use ($request, $data): Banner {
            $banner = Banner::query()->create($data);
            $this->audit($request, 'admin.banner.created', $banner, null, $banner->getAttributes());

            return $banner;
        }, 3);

        return response()->json(['banner' => $banner], 201);
    }

    public function updateBanner(Request $request, int $bannerId): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'link_url' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $banner = DB::transaction(function () use ($request, $data, $bannerId): Banner {
            $banner = Banner::query()->lockForUpdate()->findOrFail($bannerId);
            $before = $banner->getAttributes();
            $banner->update($data);
            $this->audit($request, 'admin.banner.updated', $banner, $before, $banner->fresh()->getAttributes());

            return $banner->fresh();
        }, 3);

        return response()->json(['banner' => $banner]);
    }

    public function destroyBanner(Request $request, int $bannerId): JsonResponse
    {
        DB::transaction(function () use ($request, $bannerId): void {
            $banner = Banner::query()->lockForUpdate()->findOrFail($bannerId);
            $before = $banner->getAttributes();
            $banner->delete();
            $this->audit($request, 'admin.banner.deleted', $banner, $before, null);
        }, 3);

        return response()->json([], 204);
    }

    /* -------------------------------------------------------------------------- */
    /* Staff Management (Kasir & Admin)                                           */
    /* -------------------------------------------------------------------------- */

    public function staff(): JsonResponse
    {
        $staff = User::query()
            ->whereIn('role', ['admin', 'cashier'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']);

        return response()->json(['staff' => $staff]);
    }

    public function storeStaff(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12'],
            'role' => ['required', 'string', 'in:admin,cashier'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = $data['is_active'] ?? true;

        $user = DB::transaction(function () use ($request, $data): User {
            $user = User::query()->create($data);
            $this->audit($request, 'admin.staff.created', $user, null, [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ]);

            return $user;
        }, 3);

        return response()->json(['staff' => $user->only(['id', 'name', 'email', 'role', 'is_active', 'created_at'])], 201);
    }

    public function updateStaff(Request $request, int $userId): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180', Rule::unique('users', 'email')->ignore($userId)],
            'password' => ['nullable', 'string', 'min:12'],
            'role' => ['required', 'string', 'in:admin,cashier'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $currentUser = $request->user();
        if ($currentUser->id === $userId && $data['role'] !== 'admin') {
            throw new BadRequestHttpException('Anda tidak dapat mengubah role akun Anda sendiri menjadi bukan admin.');
        }
        if ($currentUser->id === $userId && array_key_exists('is_active', $data) && ! $data['is_active']) {
            throw new BadRequestHttpException('Anda tidak dapat menonaktifkan akun Anda sendiri.');
        }

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user = DB::transaction(function () use ($request, $data, $userId): User {
            $user = User::query()->lockForUpdate()->findOrFail($userId);
            $before = $user->only(['name', 'email', 'role', 'is_active']);
            $user->update($data);
            $this->audit($request, 'admin.staff.updated', $user, $before, $user->only(['name', 'email', 'role', 'is_active']));

            return $user->fresh();
        }, 3);

        return response()->json(['staff' => $user->only(['id', 'name', 'email', 'role', 'is_active', 'created_at'])]);
    }

    public function toggleStaffStatus(Request $request, int $userId): JsonResponse
    {
        $currentUser = $request->user();
        if ($currentUser->id === $userId) {
            throw new BadRequestHttpException('Anda tidak dapat mengubah status akun Anda sendiri.');
        }

        $user = DB::transaction(function () use ($request, $userId): User {
            $user = User::query()->lockForUpdate()->findOrFail($userId);
            $before = $user->only(['name', 'email', 'role', 'is_active']);
            $user->is_active = ! $user->is_active;
            $user->save();
            $this->audit($request, 'admin.staff.status_toggled', $user, $before, $user->only(['name', 'email', 'role', 'is_active']));

            return $user;
        }, 3);

        return response()->json(['staff' => $user->only(['id', 'name', 'email', 'role', 'is_active', 'created_at'])]);
    }

    /* -------------------------------------------------------------------------- */
    /* Orders Monitor (Semua Pesanan)                                             */
    /* -------------------------------------------------------------------------- */

    public function orders(Request $request): JsonResponse
    {
        $query = Order::query()
            ->with(['items' => function ($query) {
                $query->orderBy('id');
            }, 'payments'])
            ->latest();

        if ($request->filled('q')) {
            $searchTerm = trim((string) $request->query('q'));
            $query->where(function ($sub) use ($searchTerm) {
                $sub->where('order_number', 'like', "%{$searchTerm}%")
                    ->orWhere('customer_name', 'like', "%{$searchTerm}%")
                    ->orWhere('customer_phone', 'like', "%{$searchTerm}%");
            });
        }

        if ($request->filled('status')) {
            $status = (string) $request->query('status');
            $query->where('order_status', $status);
        }

        $orders = $query->limit(100)->get();

        return response()->json(['orders' => $orders]);
    }

    /* -------------------------------------------------------------------------- */
    /* Audit Logs                                                                 */
    /* -------------------------------------------------------------------------- */

    public function auditLogs(): JsonResponse
    {
        $logs = DB::table('audit_logs')
            ->leftJoin('users', 'audit_logs.actor_id', '=', 'users.id')
            ->select([
                'audit_logs.id',
                'audit_logs.action',
                'audit_logs.subject_type',
                'audit_logs.subject_id',
                'audit_logs.before_snapshot',
                'audit_logs.after_snapshot',
                'audit_logs.ip_address',
                'audit_logs.created_at',
                'users.name as actor_name',
                'users.email as actor_email',
            ])
            ->latest('audit_logs.created_at')
            ->limit(100)
            ->get();

        return response()->json(['audit_logs' => $logs]);
    }

    /* -------------------------------------------------------------------------- */
    /* Helpers                                                                    */
    /* -------------------------------------------------------------------------- */

    private function productRules(): array
    {
        return [
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'item_type' => ['required', 'string', 'in:food,drink,other'],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'allow_notes' => ['sometimes', 'boolean'],
            'is_available' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** @param class-string<Model> $modelClass */
    private function uniqueSlug(?string $requestedSlug, string $name, string $modelClass, ?int $ignoreId = null): string
    {
        $base = Str::slug($requestedSlug ?: $name) ?: 'item';
        $candidate = $base;
        $suffix = 2;

        while ($modelClass::query()
            ->when($ignoreId !== null, fn (Builder $query) => $query->whereKeyNot($ignoreId))
            ->where('slug', $candidate)
            ->exists()) {
            $candidate = $base.'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function audit(Request $request, string $action, Model $subject, ?array $before, ?array $after): void
    {
        DB::table('audit_logs')->insert([
            'actor_id' => $request->user()->id,
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => (string) $subject->getKey(),
            'before_snapshot' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR),
            'after_snapshot' => $after === null ? null : json_encode($after, JSON_THROW_ON_ERROR),
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
