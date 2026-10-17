<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Services\Orders\CreateOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
}
