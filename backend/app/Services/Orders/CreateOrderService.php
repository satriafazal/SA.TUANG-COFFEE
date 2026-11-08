<?php

namespace App\Services\Orders;

use App\Models\Bundle;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promotion;
use App\Services\Loyalty\LoyaltyService;
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

        if (!in_array($data['payment_method'], ['cash', 'midtrans', 'qris', 'va'])) {
            throw ValidationException::withMessages([
                'payment_method' => 'Metode pembayaran tidak didukung.',
            ]);
        }

        if (!empty($data['guest_device_token'])) {
            Order::expirePendingOrders();

            $activePending = Order::query()
                ->where('guest_device_token', $data['guest_device_token'])
                ->where('order_status', 'MENUNGGU_PEMBAYARAN')
                ->where('payment_status', 'MENUNGGU')
                ->whereDate('created_at', today())
                ->where(function ($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })
                ->first();

            if ($activePending) {
                $ticketLabel = $activePending->daily_ticket_number ?? $activePending->order_number;
                throw ValidationException::withMessages([
                    'items' => "Anda masih memiliki pesanan {$ticketLabel} yang belum dibayar di kasir. Silakan bayar pesanan tersebut atau tunggu hingga hangus untuk membuat pesanan baru.",
                ]);
            }
        }

        return DB::transaction(function () use ($data, $idempotencyKey): Order {
            $itemsList = collect($data['items']);
            $productIds = $itemsList->pluck('product_id')->filter()->unique();
            $bundleIds = $itemsList->pluck('bundle_id')->filter()->unique();

            $products = $productIds->isNotEmpty()
                ? Product::query()->whereIn('id', $productIds)->lockForUpdate()->get()->keyBy('id')
                : collect();

            if ($products->count() !== $productIds->count()) {
                throw ValidationException::withMessages(['items' => 'Satu atau lebih menu tidak ditemukan.']);
            }

            $bundles = $bundleIds->isNotEmpty()
                ? Bundle::query()->with(['components.product'])->whereIn('id', $bundleIds)->lockForUpdate()->get()->keyBy('id')
                : collect();

            if ($bundles->count() !== $bundleIds->count()) {
                throw ValidationException::withMessages(['items' => 'Satu atau lebih paket menu tidak ditemukan.']);
            }

            $subtotalCents = 0;
            $preparedItems = [];

            foreach ($itemsList as $item) {
                if (!empty($item['product_id'])) {
                    /** @var Product|null $product */
                    $product = $products->get($item['product_id']);
                    if (!$product || !$product->is_active || !$product->is_available || $product->trashed()) {
                        throw ValidationException::withMessages([
                            'items' => "Menu {$product?->name} sedang tidak tersedia.",
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
                        'product_id' => $product->id,
                        'bundle_id' => null,
                        'product_name_snapshot' => $product->name,
                        'item_type' => $product->item_type,
                        'quantity' => (int) $item['quantity'],
                        'unit_price' => $this->fromCents($unitPriceCents),
                        'line_total' => $this->fromCents($lineTotalCents),
                        'special_instructions' => $item['special_instructions'] ?? null,
                    ];
                } elseif (!empty($item['bundle_id'])) {
                    /** @var Bundle|null $bundle */
                    $bundle = $bundles->get($item['bundle_id']);
                    $now = now();
                    if (!$bundle || !$bundle->is_active) {
                        throw ValidationException::withMessages([
                            'items' => "Paket menu {$bundle?->name} sedang tidak aktif.",
                        ]);
                    }
                    if (($bundle->starts_at && $now->lt($bundle->starts_at)) || ($bundle->ends_at && $now->gt($bundle->ends_at))) {
                        throw ValidationException::withMessages([
                            'items' => "Masa berlaku paket menu {$bundle->name} belum dimulai atau sudah berakhir.",
                        ]);
                    }

                    foreach ($bundle->components as $component) {
                        if (!$component->product || !$component->product->is_active || !$component->product->is_available || $component->product->trashed()) {
                            throw ValidationException::withMessages([
                                'items' => "Paket menu {$bundle->name} sedang tidak tersedia karena salah satu item ({$component->product?->name}) sedang habis.",
                            ]);
                        }
                    }

                    $unitPriceCents = $this->toCents((string) $bundle->price);
                    $lineTotalCents = $unitPriceCents * (int) $item['quantity'];
                    $subtotalCents += $lineTotalCents;

                    $preparedItems[] = [
                        'product_id' => null,
                        'bundle_id' => $bundle->id,
                        'product_name_snapshot' => $bundle->name,
                        'item_type' => 'bundle',
                        'quantity' => (int) $item['quantity'],
                        'unit_price' => $this->fromCents($unitPriceCents),
                        'line_total' => $this->fromCents($lineTotalCents),
                        'special_instructions' => $item['special_instructions'] ?? null,
                    ];
                } else {
                    throw ValidationException::withMessages(['items' => 'Item pesanan harus memiliki produk atau paket.']);
                }
            }

            $subtotal = $this->fromCents($subtotalCents);
            $discountCents = 0;
            $pointsDiscountCents = 0;
            $pricingSnapshot = ['currency' => 'IDR', 'discounts' => []];

            $pointsRedeemed = isset($data['points_redeemed']) ? (int) $data['points_redeemed'] : 0;
            $hasPromo = !empty($data['promo_code']);

            if ($hasPromo && $pointsRedeemed > 0) {
                throw ValidationException::withMessages([
                    'points_redeemed' => 'Poin loyalitas dan voucher promo tidak dapat digabungkan dalam satu pesanan.',
                ]);
            }

            if ($hasPromo) {
                $code = Str::upper(trim($data['promo_code']));
                /** @var Promotion|null $promo */
                $promo = Promotion::query()->where('code', $code)->where('is_active', true)->first();
                if (!$promo) {
                    throw ValidationException::withMessages([
                        'promo_code' => 'Kode promo tidak ditemukan atau sudah tidak aktif.',
                    ]);
                }
                $now = now();
                if (($promo->starts_at && $now->lt($promo->starts_at)) || ($promo->ends_at && $now->gt($promo->ends_at))) {
                    throw ValidationException::withMessages([
                        'promo_code' => 'Masa berlaku promo belum dimulai atau sudah berakhir.',
                    ]);
                }

                $minSpendCents = $this->toCents((string) $promo->min_spend);
                if ($subtotalCents < $minSpendCents) {
                    throw ValidationException::withMessages([
                        'promo_code' => "Minimal belanja untuk promo {$promo->code} adalah Rp ".number_format((float) $promo->min_spend, 0, ',', '.').".",
                    ]);
                }

                if ($promo->discount_type === 'percent') {
                    $discountCents = (int) round($subtotalCents * ((float) $promo->discount_value / 100));
                    if ($promo->max_discount !== null && (float) $promo->max_discount > 0) {
                        $maxCents = $this->toCents((string) $promo->max_discount);
                        $discountCents = min($discountCents, $maxCents);
                    }
                } else {
                    $discountCents = $this->toCents((string) $promo->discount_value);
                }

                $discountCents = min($discountCents, $subtotalCents);
                $discountTotalFormatted = $this->fromCents($discountCents);
                $pricingSnapshot = [
                    'currency' => 'IDR',
                    'promo' => [
                        'id' => $promo->id,
                        'code' => $promo->code,
                        'name' => $promo->name,
                        'discount_type' => $promo->discount_type,
                        'discount_value' => (string) $promo->discount_value,
                        'discount_amount' => $discountTotalFormatted,
                    ],
                    'discounts' => [
                        [
                            'type' => 'promo',
                            'code' => $promo->code,
                            'name' => $promo->name,
                            'amount' => $discountTotalFormatted,
                        ],
                    ],
                ];
            } elseif ($pointsRedeemed > 0) {
                $customerId = $data['customer_id'] ?? null;
                if (!$customerId) {
                    throw ValidationException::withMessages([
                        'points_redeemed' => 'Penukaran poin loyalitas hanya dapat digunakan oleh member yang telah login.',
                    ]);
                }

                /** @var Customer|null $customer */
                $customer = Customer::query()->where('id', $customerId)->lockForUpdate()->first();
                if (!$customer) {
                    throw ValidationException::withMessages([
                        'points_redeemed' => 'Data akun member tidak ditemukan.',
                    ]);
                }

                if ($customer->points_balance < $pointsRedeemed) {
                    throw ValidationException::withMessages([
                        'points_redeemed' => "Poin Anda tidak mencukupi (saldo poin: {$customer->points_balance}, ditukarkan: {$pointsRedeemed}).",
                    ]);
                }

                /** @var LoyaltyService $loyaltyService */
                $loyaltyService = app(LoyaltyService::class);
                $redemption = $loyaltyService->calculateRedemptionDiscount($pointsRedeemed, (float) $subtotal);

                $pointsDiscountCents = $this->toCents((string) $redemption['discount_amount']);
                $pointsDiscountCents = min($pointsDiscountCents, $subtotalCents);
                $pointsDiscountFormatted = $this->fromCents($pointsDiscountCents);

                $customer->decrement('points_balance', $pointsRedeemed);

                $pricingSnapshot = [
                    'currency' => 'IDR',
                    'loyalty' => [
                        'points_redeemed' => $pointsRedeemed,
                        'point_value_rupiah' => $redemption['point_value_rupiah'],
                        'discount_amount' => $pointsDiscountFormatted,
                    ],
                    'discounts' => [
                        [
                            'type' => 'loyalty_points',
                            'points' => $pointsRedeemed,
                            'amount' => $pointsDiscountFormatted,
                        ],
                    ],
                ];
            }

            $discountTotal = $this->fromCents($discountCents);
            $pointsDiscount = $this->fromCents($pointsDiscountCents);
            $totalCents = max(0, $subtotalCents - $discountCents - $pointsDiscountCents);
            $total = $this->fromCents($totalCents);

            $order = Order::create([
                'order_number' => $this->newOrderNumber(),
                'daily_ticket_number' => $this->newDailyTicketNumber(),
                'user_id' => auth()->id(),
                'customer_id' => $data['customer_id'] ?? null,
                'guest_device_token' => $data['guest_device_token'] ?? null,
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'] ?? null,
                'order_status' => 'MENUNGGU_PEMBAYARAN',
                'payment_status' => 'MENUNGGU',
                'payment_method' => $data['payment_method'],
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'points_discount' => $pointsDiscount,
                'total' => $total,
                'points_redeemed' => $pointsRedeemed,
                'pricing_snapshot' => $pricingSnapshot,
                'idempotency_key' => $idempotencyKey,
                'expires_at' => in_array($data['payment_method'], ['midtrans', 'qris', 'va']) ? now()->addMinutes(15) : now()->addMinutes(10),
            ]);

            foreach ($preparedItems as $item) {
                $order->items()->create([
                    'product_id' => $item['product_id'],
                    'bundle_id' => $item['bundle_id'],
                    'product_name_snapshot' => $item['product_name_snapshot'],
                    'item_type' => $item['item_type'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                    'special_instructions' => $item['special_instructions'],
                    'preparation_status' => 'MENUNGGU',
                ]);
            }

            $isOnline = in_array($data['payment_method'], ['midtrans', 'qris', 'va']);
            $snapData = null;
            if ($isOnline) {
                $order->load('items');
                $snapService = app(\App\Services\Payments\MidtransSnapService::class);
                $snapData = $snapService->createSnapTransaction($order);
            }

            $order->payments()->create([
                'method' => $data['payment_method'],
                'status' => 'MENUNGGU',
                'amount' => $total,
                'provider' => $isOnline ? 'midtrans' : null,
                'provider_reference' => $snapData['token'] ?? null,
                'provider_metadata' => $snapData,
            ]);

            $order->statusHistory()->create([
                'from_status' => null,
                'to_status' => 'MENUNGGU_PEMBAYARAN',
                'reason' => $isOnline ? 'Pesanan dibuat. Menunggu pembayaran online.' : 'Pesanan dibuat oleh pelanggan.',
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

    private function newDailyTicketNumber(): string
    {
        $todayCount = Order::whereDate('created_at', today())->count();

        return sprintf('#%03d', $todayCount + 1);
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
