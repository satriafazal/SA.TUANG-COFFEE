<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Orders\CreateOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function store(Request $request, CreateOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:160'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'payment_method' => ['required', 'string', 'in:cash,va,qris'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
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
