<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrackOrderController extends Controller
{
    public function show(Request $request, string $orderNumber): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:160'],
        ]);

        $order = Order::query()
            ->where('order_number', $orderNumber)
            ->whereRaw('LOWER(customer_name) = LOWER(?)', [trim($validated['customer_name'])])
            ->with(['items:id,order_id,product_name_snapshot,item_type,quantity,preparation_status'])
            ->firstOrFail();

        return response()->json([
            'order' => [
                'order_number' => $order->order_number,
                'daily_ticket_number' => $order->daily_ticket_number,
                'order_status' => $order->order_status,
                'payment_status' => $order->payment_status,
                'created_at' => $order->created_at,
                'items' => $order->items->map(fn ($item): array => [
                    'name' => $item->product_name_snapshot,
                    'item_type' => $item->item_type,
                    'quantity' => $item->quantity,
                    'preparation_status' => $item->preparation_status,
                ]),
            ],
        ]);
    }
}
