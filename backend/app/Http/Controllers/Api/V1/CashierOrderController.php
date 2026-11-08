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
            ->get(['id', 'name', 'item_type', 'price', 'is_available', 'image_path']);

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
            'status' => ['nullable', 'string', 'in:MENUNGGU_PEMBAYARAN,PESANAN_DITERIMA,SEDANG_DIBUAT,SIAP_DIAMBIL,SELESAI,DIBATALKAN'],
            'scope' => ['nullable', 'string', 'in:all,active,completed,cancelled'],
            'q' => ['nullable', 'string', 'max:160'],
            'date' => ['nullable', 'date'],
            'all_dates' => ['nullable', 'boolean'],
        ]);

        Order::expirePendingOrders();

        $query = Order::query();

        // Default: filter by today's date so queue repeats daily
        if (empty($filters['all_dates'])) {
            $date = $filters['date'] ?? today();
            $query->whereDate('created_at', $date);
        }

        // Apply scope if specified
        $scope = $filters['scope'] ?? 'all';
        if ($scope === 'active') {
            $query->whereNotIn('order_status', ['SELESAI', 'DIBATALKAN']);
        } elseif ($scope === 'completed') {
            $query->where('order_status', 'SELESAI');
        } elseif ($scope === 'cancelled') {
            $query->where('order_status', 'DIBATALKAN');
        }

        $query->where(function (Builder $nested): void {
            $nested->where('payment_method', 'cash')
                ->orWhere(function (Builder $onlineQuery): void {
                    $onlineQuery->where('payment_method', '!=', 'cash')
                        ->where('payment_status', 'BERHASIL')
                        ->where('order_status', '!=', 'MENUNGGU_PEMBAYARAN');
                });
        });

        if (!empty($filters['status'])) {
            $query->where('order_status', $filters['status']);
        }

        if (!empty($filters['q'])) {
            $term = $filters['q'];
            $query->where(fn (Builder $nested) => $nested
                ->where('order_number', 'ilike', '%'.$term.'%')
                ->orWhere('daily_ticket_number', 'ilike', '%'.$term.'%')
                ->orWhere('customer_name', 'ilike', '%'.$term.'%'));
        }

        $orders = $query->with(['items', 'payments'])
            ->latest()
            ->limit(200)
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
                    ->orWhere('daily_ticket_number', 'ilike', '%'.$term.'%')
                    ->orWhere('customer_name', 'ilike', '%'.$term.'%'));
            })
            ->with(['items', 'payments'])
            ->orderByDesc('completed_at')
            ->limit(100)
            ->get();

        return response()->json(['orders' => $orders]);
    }

    public function cancelled(Request $request): JsonResponse
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:160']]);
        $orders = Order::query()
            ->where('order_status', 'DIBATALKAN')
            ->when($filters['q'] ?? null, function (Builder $query, string $term): void {
                $query->where(fn (Builder $nested) => $nested
                    ->where('order_number', 'ilike', '%'.$term.'%')
                    ->orWhere('daily_ticket_number', 'ilike', '%'.$term.'%')
                    ->orWhere('customer_name', 'ilike', '%'.$term.'%'));
            })
            ->with(['items', 'payments'])
            ->orderByDesc('cancelled_at')
            ->orderByDesc('updated_at')
            ->limit(100)
            ->get();

        return response()->json(['orders' => $orders]);
    }

    public function confirmPayment(Request $request, string $orderNumber): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $orderNumber): Order {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();
            if ($order->expires_at && $order->expires_at->isPast()) {
                $order->update([
                    'order_status' => 'DIBATALKAN',
                    'cancelled_at' => now(),
                ]);
                $order->refundRedeemedPointsIfCancelled();
                throw new ConflictHttpException('Batas waktu pembayaran tunai telah kedaluwarsa. Pesanan dibatalkan.');
            }
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
                'order_status' => 'SEDANG_DIBUAT',
                'confirmed_at' => $now,
                'expires_at' => null,
            ]);

            $order->items()->where('preparation_status', 'MENUNGGU')->update([
                'preparation_status' => 'DIPROSES',
            ]);

            if ($order->customer_id && ($customer = \App\Models\Customer::find($order->customer_id))) {
                $earnedPoints = app(\App\Services\Loyalty\LoyaltyService::class)->calculateEarnedPoints((float) $order->total);
                if ($earnedPoints > 0) {
                    $customer->increment('points_balance', $earnedPoints);
                }
            }
            $order->statusHistory()->create([
                'from_status' => 'MENUNGGU_PEMBAYARAN',
                'to_status' => 'SEDANG_DIBUAT',
                'actor_id' => $request->user()->id,
                'reason' => 'Kasir mengonfirmasi pembayaran Cash dan pesanan langsung diproses.',
            ]);
            $order->printJobs()->createMany([
                ['document_type' => 'invoice', 'destination' => 'cashier', 'status' => 'MENUNGGU'],
                ['document_type' => 'kot', 'destination' => 'kitchen_bar', 'status' => 'MENUNGGU'],
            ]);

            return $order->load(['items', 'payments']);
        }, 3);

        return response()->json(['order' => $order]);
    }

    public function confirmOnline(Request $request, string $orderNumber): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $orderNumber): Order {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();

            if ($order->payment_method === 'cash') {
                throw new ConflictHttpException('Pesanan tunai harus dikonfirmasi melalui konfirmasi pembayaran tunai.');
            }

            if ($order->payment_status !== 'BERHASIL') {
                throw new ConflictHttpException('Pembayaran cashless belum terverifikasi lunas.');
            }

            /** @var Payment|null $payment */
            $payment = $order->payments()->lockForUpdate()->where('status', 'BERHASIL')->latest()->first()
                ?: $order->payments()->first();

            $now = now();
            if ($payment) {
                $payment->update([
                    'verified_by' => $request->user()->id,
                    'verified_at' => $payment->verified_at ?? $now,
                ]);
            }

            if ($order->order_status === 'PESANAN_DITERIMA') {
                $order->update(['order_status' => 'SEDANG_DIBUAT']);
                $order->items()->where('preparation_status', 'MENUNGGU')->update([
                    'preparation_status' => 'DIPROSES',
                ]);
                $order->statusHistory()->create([
                    'from_status' => 'PESANAN_DITERIMA',
                    'to_status' => 'SEDANG_DIBUAT',
                    'actor_id' => $request->user()->id,
                    'reason' => 'Kasir mengonfirmasi pembayaran cashless dan pesanan langsung diproses.',
                ]);
            } else {
                $order->statusHistory()->create([
                    'from_status' => $order->order_status,
                    'to_status' => $order->order_status,
                    'actor_id' => $request->user()->id,
                    'reason' => 'Kasir mengonfirmasi pesanan cashless dan mencetak struk.',
                ]);
            }

            $order->printJobs()->where('status', 'MENUNGGU')->update([
                'status' => 'SELESAI',
                'printed_at' => $now,
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

            $targetType = $data['item_type'];
            $items = $order->items()
                ->where(function ($query) use ($targetType) {
                    if ($targetType === 'drink') {
                        $query->whereIn('item_type', ['drink', 'bundle']);
                    } else {
                        $query->where('item_type', $targetType);
                    }
                })
                ->lockForUpdate()
                ->get();
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
