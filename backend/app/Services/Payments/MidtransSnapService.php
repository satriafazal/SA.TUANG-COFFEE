<?php

namespace App\Services\Payments;

use App\Models\Order;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class MidtransSnapService
{
    protected string $serverKey;
    protected string $clientKey;
    protected bool $isProduction;
    protected string $snapUrl;

    public function __construct()
    {
        $this->serverKey = config('services.midtrans.server_key', '');
        $this->clientKey = config('services.midtrans.client_key', '');
        $this->isProduction = (bool) config('services.midtrans.is_production', false);
        $this->snapUrl = $this->isProduction
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
    }

    public function createSnapTransaction(Order $order): array
    {
        $grossAmount = (int) round((float) $order->total);

        // Build item details
        $itemDetails = [];
        $itemsSum = 0;

        foreach ($order->items as $item) {
            $price = (int) round((float) $item->unit_price);
            $qty = (int) $item->quantity;
            $itemsSum += ($price * $qty);
            $itemDetails[] = [
                'id' => $item->product_id ? 'P-'.$item->product_id : 'B-'.$item->bundle_id,
                'price' => $price,
                'quantity' => $qty,
                'name' => mb_substr($item->product_name_snapshot, 0, 50),
            ];
        }

        if ((float) $order->discount_total > 0) {
            $discount = (int) round((float) $order->discount_total);
            $itemsSum -= $discount;
            $itemDetails[] = [
                'id' => 'PROMO-DISCOUNT',
                'price' => -$discount,
                'quantity' => 1,
                'name' => 'Potongan Promo',
            ];
        }

        // Midtrans requires exact match: sum(item_details) === gross_amount
        $payloadItems = ($itemsSum === $grossAmount) ? $itemDetails : null;

        $params = [
            'transaction_details' => [
                'order_id' => $order->order_number,
                'gross_amount' => $grossAmount,
            ],
            'customer_details' => [
                'first_name' => $order->customer_name,
                'phone' => $order->customer_phone ?: '',
            ],
            'enabled_payments' => [
                'qris', 'gopay', 'shopeepay', 'other_qris',
                'bca_va', 'bni_va', 'bri_va', 'echannel', 'permata_va', 'other_va',
            ],
            'expiry' => [
                'unit' => 'minute',
                'duration' => 15,
            ],
        ];

        if ($payloadItems !== null) {
            $params['item_details'] = $payloadItems;
        }

        // In testing environment or if server key is empty, return a mock token
        if (app()->environment('testing') && !Http::recorded()) {
            return [
                'token' => 'mock-snap-token-'.$order->order_number,
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-'.$order->order_number,
            ];
        }

        if (empty($this->serverKey)) {
            return [
                'token' => 'mock-snap-token-'.$order->order_number,
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-'.$order->order_number,
            ];
        }

        try {
            $response = Http::withHeaders([
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'Authorization' => 'Basic ' . base64_encode($this->serverKey . ':'),
            ])->timeout(10)->post($this->snapUrl, $params);

            if ($response->successful()) {
                $body = $response->json();
                return [
                    'token' => $body['token'] ?? null,
                    'redirect_url' => $body['redirect_url'] ?? null,
                ];
            }

            Log::error('Midtrans Snap Error: ' . $response->body());
            throw ValidationException::withMessages([
                'payment_method' => 'Gagal menghubungkan gateway pembayaran Midtrans: ' . ($response->json('error_messages.0') ?? 'Respon tidak valid.'),
            ]);
        } catch (\Exception $e) {
            if ($e instanceof ValidationException) {
                throw $e;
            }
            Log::error('Midtrans Exception: ' . $e->getMessage());
            throw ValidationException::withMessages([
                'payment_method' => 'Terjadi kendala saat menghubungi gateway Midtrans. Silakan gunakan pembayaran tunai di kasir.',
            ]);
        }
    }

    public function getTransactionStatus(string $orderNumber): ?array
    {
        if (empty($this->serverKey)) {
            return null;
        }

        $statusUrl = $this->isProduction
            ? "https://api.midtrans.com/v2/{$orderNumber}/status"
            : "https://api.sandbox.midtrans.com/v2/{$orderNumber}/status";

        try {
            $response = Http::withHeaders([
                'Accept' => 'application/json',
                'Authorization' => 'Basic ' . base64_encode($this->serverKey . ':'),
            ])->timeout(6)->get($statusUrl);

            if ($response->successful()) {
                return $response->json();
            }
        } catch (\Exception $e) {
            Log::warning('Midtrans check status exception: ' . $e->getMessage());
        }

        return null;
    }

    public function syncOrderStatus(Order $order): bool
    {
        $statusData = $this->getTransactionStatus($order->order_number);
        if (!$statusData) {
            return false;
        }

        $transactionStatus = (string) ($statusData['transaction_status'] ?? '');
        $fraudStatus = (string) ($statusData['fraud_status'] ?? '');
        $paymentType = (string) ($statusData['payment_type'] ?? 'online');

        $isPaid = false;
        $isFailed = false;

        if ($transactionStatus === 'capture') {
            if ($fraudStatus === 'accept') {
                $isPaid = true;
            }
        } elseif ($transactionStatus === 'settlement') {
            $isPaid = true;
        } elseif (in_array($transactionStatus, ['cancel', 'deny', 'expire'], true)) {
            $isFailed = true;
        }

        if ($isPaid && $order->payment_status !== 'BERHASIL') {
            $now = now();
            $order->update([
                'payment_status' => 'BERHASIL',
                'order_status' => 'PESANAN_DITERIMA',
                'confirmed_at' => $now,
                'expires_at' => null,
            ]);

            $payment = $order->payments()->where('provider', 'midtrans')->latest()->first()
                ?: $order->payments()->first();
            if ($payment) {
                $payment->update([
                    'status' => 'BERHASIL',
                    'verified_at' => $now,
                    'provider_metadata' => $statusData,
                ]);
            }

            if ($order->customer_id && ($customer = \App\Models\Customer::find($order->customer_id))) {
                $earnedPoints = app(\App\Services\Loyalty\LoyaltyService::class)->calculateEarnedPoints((float) $order->total);
                if ($earnedPoints > 0) {
                    $customer->increment('points_balance', $earnedPoints);
                }
            }

            $order->statusHistory()->create([
                'from_status' => 'MENUNGGU_PEMBAYARAN',
                'to_status' => 'PESANAN_DITERIMA',
                'reason' => "Sinkronisasi Midtrans berhasil ({$paymentType}).",
            ]);

            $order->printJobs()->createMany([
                ['document_type' => 'invoice', 'destination' => 'cashier', 'status' => 'MENUNGGU'],
                ['document_type' => 'kot', 'destination' => 'kitchen_bar', 'status' => 'MENUNGGU'],
            ]);

            return true;
        } elseif ($isFailed && $order->order_status !== 'DIBATALKAN') {
            $now = now();
            $order->update([
                'payment_status' => 'GAGAL',
                'order_status' => 'DIBATALKAN',
                'cancelled_at' => $now,
            ]);
            $order->refundRedeemedPointsIfCancelled();

            $payment = $order->payments()->where('provider', 'midtrans')->latest()->first()
                ?: $order->payments()->first();
            if ($payment) {
                $payment->update([
                    'status' => $transactionStatus === 'expire' ? 'KADALUARSA' : 'GAGAL',
                    'provider_metadata' => $statusData,
                ]);
            }

            $order->statusHistory()->create([
                'from_status' => $order->order_status,
                'to_status' => 'DIBATALKAN',
                'reason' => "Sinkronisasi Midtrans {$transactionStatus}.",
            ]);

            return true;
        }

        return false;
    }
}

