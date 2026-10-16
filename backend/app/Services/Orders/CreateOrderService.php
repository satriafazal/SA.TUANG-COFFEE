<?php

namespace App\Services\Orders;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateOrderService
{
    public function create(array $data, ?string $idempotencyKey = null): Order
    {
        if ($idempotencyKey !== null && ($existing = Order::with(['items', 'payments'])->where('idempotency_key', $idempotencyKey)->first())) {
            return $existing;
        }

        if ($data['payment_method'] !== 'cash') {
            throw ValidationException::withMessages([
                'payment_method' => 'Pembayaran VA/QRIS belum dapat digunakan karena payment gateway belum dikonfigurasi.',
            ]);
        }

        return DB::transaction(function () use ($data, $idempotencyKey): Order {
            $requested = collect($data['items'])->keyBy('product_id');
            $products = Product::query()
                ->whereIn('id', $requested->keys())
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($products->count() !== $requested->count()) {
                throw ValidationException::withMessages(['items' => 'Satu atau lebih menu tidak ditemukan.']);
            }

            $subtotalCents = 0;
            $preparedItems = [];

            foreach ($requested as $productId => $item) {
                /** @var Product $product */
                $product = $products->get($productId);
                if (!$product->is_active || !$product->is_available || $product->trashed()) {
                    throw ValidationException::withMessages([
                        'items' => "Menu {$product->name} sedang tidak tersedia.",
                    ]);
                }

                if (!empty($item['special_instructions']) && !$product->allow_notes) {
                    throw ValidationException::withMessages([
                        'items' => "Catatan khusus tidak tersedia untuk menu {$product->name}.",
                    ]);
                }

                $unitPriceCents = $this->toCents((string) $product->price);
                $lineTotalCents = $unitPriceCents * (int) $item['quantity'];
                $subtotalCents += $lineTotalCents;
                $preparedItems[] = [
                    'product' => $product,
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => $this->fromCents($unitPriceCents),
                    'line_total' => $this->fromCents($lineTotalCents),
                    'special_instructions' => $item['special_instructions'] ?? null,
                ];
            }

            $subtotal = $this->fromCents($subtotalCents);
            $order = Order::create([
                'order_number' => $this->newOrderNumber(),
                'user_id' => auth()->id(),
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'] ?? null,
                'order_status' => 'MENUNGGU_PEMBAYARAN',
                'payment_status' => 'MENUNGGU',
                'payment_method' => $data['payment_method'],
                'subtotal' => $subtotal,
                'discount_total' => '0.00',
                'points_discount' => '0.00',
                'total' => $subtotal,
                'points_redeemed' => 0,
                'pricing_snapshot' => ['currency' => 'IDR', 'discounts' => []],
                'idempotency_key' => $idempotencyKey,
            ]);

            foreach ($preparedItems as $item) {
                $order->items()->create([
                    'product_id' => $item['product']->id,
                    'product_name_snapshot' => $item['product']->name,
                    'item_type' => $item['product']->item_type,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                    'special_instructions' => $item['special_instructions'],
                    'preparation_status' => 'MENUNGGU',
                ]);
            }

            $order->payments()->create([
                'method' => 'cash',
                'status' => 'MENUNGGU',
                'amount' => $subtotal,
            ]);

            $order->statusHistory()->create([
                'from_status' => null,
                'to_status' => 'MENUNGGU_PEMBAYARAN',
                'reason' => 'Pesanan dibuat oleh pelanggan.',
            ]);

            return $order->load(['items', 'payments']);
        }, 3);
    }

    private function newOrderNumber(): string
    {
        do {
            $number = 'ST-'.now()->format('ymd').'-'.Str::upper(Str::random(6));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }

    private function toCents(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '0');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    private function fromCents(int $amount): string
    {
        return intdiv($amount, 100).'.'.str_pad((string) ($amount % 100), 2, '0', STR_PAD_LEFT);
    }
}
