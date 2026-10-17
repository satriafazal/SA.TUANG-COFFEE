<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class CashierOrderController extends Controller
{
    public function products(): JsonResponse
    {
        $products = Product::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'item_type', 'price', 'is_available']);

        $bundles = Bundle::query()
            ->with([
                'category:id,name,slug',
                'components.product:id,name,price,item_type,is_available',
            ])
            ->orderBy('name')
            ->get(['id', 'category_id', 'name', 'slug', 'description', 'price', 'is_active', 'image_path']);

        return response()->json([
            'products' => $products,
            'bundles' => $bundles,
        ]);
    }

    public function updateProductAvailability(Request $request, int $productId): JsonResponse
    {
        $data = $request->validate(['is_available' => ['required', 'boolean']]);

        $product = DB::transaction(function () use ($productId, $data): Product {
            $product = Product::query()
                ->where('is_active', true)
                ->whereKey($productId)
                ->lockForUpdate()
                ->firstOrFail();
            $product->update(['is_available' => $data['is_available']]);

            return $product->fresh();
        }, 3);

        return response()->json(['product' => $product]);
    }

    public function updateBundleAvailability(Request $request, int $bundleId): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);

        $bundle = DB::transaction(function () use ($bundleId, $data): Bundle {
            $bundle = Bundle::query()
                ->whereKey($bundleId)
                ->lockForUpdate()
                ->firstOrFail();
            $bundle->update(['is_active' => $data['is_active']]);

            return $bundle->fresh()->load(['components.product:id,name,price,item_type,is_available']);
        }, 3);

        return response()->json(['bundle' => $bundle]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'in:MENUNGGU_PEMBAYARAN,PESANAN_DITERIMA,SEDANG_DIBUAT,SIAP_DIAMBIL'],
            'q' => ['nullable', 'string', 'max:160'],
        ]);

        $orders = Order::query()
            ->where('order_status', '!=', 'SELESAI')
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('order_status', $status))
            ->when($filters['q'] ?? null, function (Builder $query, string $term): void {
                $query->where(fn (Builder $nested) => $nested
                    ->where('order_number', 'ilike', '%'.$term.'%')
                    ->orWhere('customer_name', 'ilike', '%'.$term.'%'));
            })
            ->with(['items', 'payments'])
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['orders' => $orders]);
    }

    public function completed(Request $request): JsonResponse
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:160']]);
        $orders = Order::query()
            ->where('order_status', 'SELESAI')
            ->when($filters['q'] ?? null, function (Builder $query, string $term): void {
                $query->where(fn (Builder $nested) => $nested
                    ->where('order_number', 'ilike', '%'.$term.'%')
                    ->orWhere('customer_name', 'ilike', '%'.$term.'%'));
            })
            ->with(['items', 'payments'])
            ->orderByDesc('completed_at')
            ->limit(100)
            ->get();

        return response()->json(['orders' => $orders]);
    }

    public function confirmPayment(Request $request, string $orderNumber): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $orderNumber): Order {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            if ($order->payment_method !== 'cash' || $order->payment_status !== 'MENUNGGU' || $order->order_status !== 'MENUNGGU_PEMBAYARAN') {
                throw new ConflictHttpException('Pembayaran ini tidak dapat dikonfirmasi ulang atau bukan pembayaran Cash.');
            }

            /** @var Payment|null $payment */
            $payment = $order->payments()->lockForUpdate()->where('status', 'MENUNGGU')->first();
            if (!$payment) {
                throw new ConflictHttpException('Pembayaran menunggu tidak ditemukan.');
            }

            $now = now();
            $payment->update([
                'status' => 'BERHASIL',
                'verified_by' => $request->user()->id,
                'verified_at' => $now,
            ]);
            $order->update([
                'payment_status' => 'BERHASIL',
                'order_status' => 'PESANAN_DITERIMA',
                'confirmed_at' => $now,
            ]);
            $order->statusHistory()->create([
                'from_status' => 'MENUNGGU_PEMBAYARAN',
                'to_status' => 'PESANAN_DITERIMA',
                'actor_id' => $request->user()->id,
                'reason' => 'Kasir mengonfirmasi pembayaran Cash.',
            ]);
            $order->printJobs()->createMany([
                ['document_type' => 'invoice', 'destination' => 'cashier', 'status' => 'MENUNGGU'],
                ['document_type' => 'kot', 'destination' => 'kitchen_bar', 'status' => 'MENUNGGU'],
            ]);

            return $order->load(['items', 'payments']);
        }, 3);

        return response()->json(['order' => $order]);
    }

    public function updatePreparationGroupStatus(Request $request, string $orderNumber): JsonResponse
    {
        $data = $request->validate([
            'item_type' => ['required', 'string', 'max:16'],
            'status' => ['required', 'string', 'in:DIPROSES,SIAP'],
        ]);

        $result = DB::transaction(function () use ($request, $orderNumber, $data): array {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            if (!in_array($order->order_status, ['PESANAN_DITERIMA', 'SEDANG_DIBUAT', 'SIAP_DIAMBIL'], true)) {
                throw new ConflictHttpException('Kategori hanya dapat diperbarui saat pesanan diterima atau sedang dibuat.');
            }

            $items = $order->items()->where('item_type', $data['item_type'])->lockForUpdate()->get();
            if ($items->isEmpty()) {
                throw new ConflictHttpException('Kategori tersebut tidak ditemukan pada pesanan ini.');
            }

            $items->each(fn (OrderItem $item) => $item->update(['preparation_status' => $data['status']]));
            $allReady = !$order->items()->where('preparation_status', '!=', 'SIAP')->exists();
            $nextStatus = $allReady ? 'SIAP_DIAMBIL' : 'SEDANG_DIBUAT';
            if ($order->order_status !== $nextStatus) {
                $previous = $order->order_status;
                $order->update(['order_status' => $nextStatus]);
                $groupLabel = match ($data['item_type']) {
                    'food' => 'Makanan',
                    'drink' => 'Minuman',
                    default => 'Lainnya',
                };
                $order->statusHistory()->create([
                    'from_status' => $previous,
                    'to_status' => $nextStatus,
                    'actor_id' => $request->user()->id,
                    'reason' => "Kasir memperbarui kesiapan kategori {$groupLabel}.",
                ]);
            }

            return ['item_type' => $data['item_type'], 'order_status' => $nextStatus];
        }, 3);

        return response()->json($result);
    }

    public function complete(Request $request, string $orderNumber): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $orderNumber): Order {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            if ($order->order_status !== 'SIAP_DIAMBIL' || $order->payment_status !== 'BERHASIL') {
                throw new ConflictHttpException('Pesanan hanya dapat diselesaikan setelah seluruh item siap dan pembayaran valid.');
            }

            $now = now();
            $order->update(['order_status' => 'SELESAI', 'completed_at' => $now]);
            $order->statusHistory()->create([
                'from_status' => 'SIAP_DIAMBIL',
                'to_status' => 'SELESAI',
                'actor_id' => $request->user()->id,
                'reason' => 'Pesanan diserahkan kepada pelanggan.',
            ]);

            return $order->load(['items', 'payments']);
        }, 3);

        return response()->json(['order' => $order]);
    }
}
