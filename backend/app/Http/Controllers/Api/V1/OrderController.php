<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Promotion;
use App\Services\Orders\CreateOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class OrderController extends Controller
{
    public function validatePromo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        $code = Str::upper(trim($data['code']));
        /** @var Promotion|null $promo */
        $promo = Promotion::query()->where('code', $code)->where('is_active', true)->first();
        if (!$promo) {
            return response()->json([
                'valid' => false,
                'message' => 'Kode promo tidak ditemukan atau sudah tidak aktif.',
            ], 422);
        }

        $now = now();
        if ($promo->starts_at && $now->lt($promo->starts_at)) {
            return response()->json([
                'valid' => false,
                'message' => 'Promo ini belum mulai berlaku.',
            ], 422);
        }
        if ($promo->ends_at && $now->gt($promo->ends_at)) {
            return response()->json([
                'valid' => false,
                'message' => 'Masa berlaku promo ini sudah berakhir.',
            ], 422);
        }

        $subtotal = (float) $data['subtotal'];
        $minSpend = (float) $promo->min_spend;
        if ($subtotal < $minSpend) {
            return response()->json([
                'valid' => false,
                'message' => 'Minimal belanja untuk promo ini adalah Rp '.number_format($minSpend, 0, ',', '.').'.',
            ], 422);
        }

        if ($promo->discount_type === 'percent') {
            $discountAmount = round($subtotal * ((float) $promo->discount_value / 100));
            if ($promo->max_discount !== null && (float) $promo->max_discount > 0) {
                $discountAmount = min($discountAmount, (float) $promo->max_discount);
            }
        } else {
            $discountAmount = (float) $promo->discount_value;
        }

        $discountAmount = min($discountAmount, $subtotal);

        return response()->json([
            'valid' => true,
            'promo' => [
                'id' => $promo->id,
                'code' => $promo->code,
                'name' => $promo->name,
                'discount_type' => $promo->discount_type,
                'discount_value' => (float) $promo->discount_value,
                'min_spend' => (float) $promo->min_spend,
                'max_discount' => $promo->max_discount !== null ? (float) $promo->max_discount : null,
            ],
            'discount_amount' => $discountAmount,
            'discount_amount_formatted' => 'Rp '.number_format($discountAmount, 0, ',', '.'),
            'message' => "Kode promo {$promo->code} berhasil diterapkan!",
        ]);
    }

    public function store(Request $request, CreateOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:160'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'guest_device_token' => ['nullable', 'string', 'max:96'],
            'payment_method' => ['required', 'string', 'in:cash,va,qris'],
            'promo_code' => ['nullable', 'string', 'max:50'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.product_id' => ['nullable', 'required_without:items.*.bundle_id', 'integer', 'exists:products,id'],
            'items.*.bundle_id' => ['nullable', 'required_without:items.*.product_id', 'integer', 'exists:bundles,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:30'],
            'items.*.special_instructions' => ['nullable', 'string', 'max:500'],
        ]);
        $data['customer_name'] = trim($data['customer_name']);
        $data['payment_method'] = Str::lower($data['payment_method']);

        $user = auth('sanctum')->user();
        if ($user instanceof \App\Models\Customer) {
            $data['customer_id'] = $user->id;
        }

        $idempotencyKey = $request->header('Idempotency-Key');
        if ($idempotencyKey !== null && (strlen($idempotencyKey) > 96 || trim($idempotencyKey) === '')) {
            return response()->json(['message' => 'Header Idempotency-Key tidak valid.'], 422);
        }

        $order = $service->create($data, $idempotencyKey);

        return response()->json([
            'order' => $order,
            'message' => 'Pesanan tercatat. Pembayaran Cash perlu dikonfirmasi kasir.',
        ], 201);
    }

    public function myOrders(Request $request): JsonResponse
    {
        $deviceToken = $request->query('device_token') ?: $request->header('X-Device-Token');
        $user = auth('sanctum')->user();
        $customerId = $user instanceof \App\Models\Customer ? $user->id : null;

        if (!$deviceToken && !$customerId) {
            return response()->json(['orders' => []]);
        }

        Order::query()
            ->where('order_status', 'MENUNGGU_PEMBAYARAN')
            ->where('payment_status', 'MENUNGGU')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->update([
                'order_status' => 'DIBATALKAN',
                'cancelled_at' => now(),
            ]);

        $orders = \App\Models\Order::query()
            ->when($customerId, function ($query) use ($customerId, $deviceToken) {
                $query->where('customer_id', $customerId)
                    ->when($deviceToken, fn ($nested) => $nested->orWhere('guest_device_token', $deviceToken));
            }, function ($query) use ($deviceToken) {
                $query->where('guest_device_token', $deviceToken);
            })
            ->with(['items', 'payments'])
            ->latest()
            ->limit(30)
            ->get();

        return response()->json(['orders' => $orders]);
    }

    public function complete(Request $request, string $orderNumber): JsonResponse
    {
        $deviceToken = $request->input('device_token') ?: $request->header('X-Device-Token');
        $user = auth('sanctum')->user();
        $customerId = $user instanceof Customer ? $user->id : null;

        $order = DB::transaction(function () use ($request, $orderNumber, $customerId, $deviceToken): Order {
            $order = Order::where('order_number', $orderNumber)->lockForUpdate()->firstOrFail();

            $isOwner = false;
            if ($customerId && $order->customer_id === $customerId) {
                $isOwner = true;
            } elseif ($deviceToken && $order->guest_device_token === $deviceToken) {
                $isOwner = true;
            } elseif (
                !$order->customer_id
                && !$order->guest_device_token
                && $request->filled('customer_name')
                && strcasecmp(trim((string) $order->customer_name), trim((string) $request->input('customer_name'))) === 0
            ) {
                $isOwner = true;
            }

            if (!$isOwner) {
                throw new AccessDeniedHttpException('Anda tidak memiliki akses untuk menyelesaikan pesanan ini.');
            }

            if ($order->order_status !== 'SIAP_DIAMBIL') {
                throw new ConflictHttpException('Pesanan hanya dapat diselesaikan setelah status Siap Diambil.');
            }

            $now = now();
            $order->update([
                'order_status' => 'SELESAI',
                'completed_at' => $now,
            ]);

            $order->statusHistory()->create([
                'from_status' => 'SIAP_DIAMBIL',
                'to_status' => 'SELESAI',
                'reason' => 'Pelanggan telah mengambil pesanan.',
            ]);

            return $order->load(['items', 'payments']);
        }, 3);

        return response()->json([
            'order' => $order,
            'message' => 'Pesanan berhasil diselesaikan. Terima kasih telah memesan di SA.TUANG COFFEE!',
        ]);
    }
}
