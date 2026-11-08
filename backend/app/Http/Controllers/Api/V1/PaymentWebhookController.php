<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $orderId = (string) $request->input('order_id');
        $statusCode = (string) $request->input('status_code');
        $grossAmount = (string) $request->input('gross_amount');
        $serverKey = (string) config('services.midtrans.server_key', '');
        $signatureKey = (string) $request->input('signature_key');

        // Verify SHA512 signature if server key is configured
        if ($serverKey !== '') {
            $expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);
            if (!hash_equals($expectedSignature, $signatureKey)) {
                Log::warning('Midtrans Webhook: Invalid signature', [
                    'order_id' => $orderId,
                    'received' => $signatureKey,
                ]);

                return response()->json(['message' => 'Signature key tidak valid.'], 403);
            }
        }

        $order = Order::with('payments')->where('order_number', $orderId)->first();
        if (!$order) {
            return response()->json(['message' => 'Pesanan tidak ditemukan.'], 404);
        }

        $transactionStatus = (string) $request->input('transaction_status');
        $fraudStatus = (string) $request->input('fraud_status');
        $paymentType = (string) $request->input('payment_type', 'online');

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

        DB::transaction(function () use ($order, $isPaid, $isFailed, $transactionStatus, $paymentType, $request) {
            $now = now();
            $payment = $order->payments()->where('provider', 'midtrans')->latest()->first()
                ?: $order->payments()->first();

            if ($isPaid) {
                if ($order->payment_status !== 'BERHASIL') {
                    $order->update([
                        'payment_status' => 'BERHASIL',
                        'order_status' => 'PESANAN_DITERIMA',
                        'confirmed_at' => $now,
                        'expires_at' => null,
                    ]);

                    if ($payment) {
                        $payment->update([
                            'status' => 'BERHASIL',
                            'verified_at' => $now,
                            'provider_metadata' => $request->all(),
                        ]);
                    }

                    if ($order->customer_id && ($customer = Customer::find($order->customer_id))) {
                        $earnedPoints = app(\App\Services\Loyalty\LoyaltyService::class)->calculateEarnedPoints((float) $order->total);
                        if ($earnedPoints > 0) {
                            $customer->increment('points_balance', $earnedPoints);
                        }
                    }

                    $order->statusHistory()->create([
                        'from_status' => 'MENUNGGU_PEMBAYARAN',
                        'to_status' => 'PESANAN_DITERIMA',
                        'reason' => "Pembayaran online Midtrans berhasil ({$paymentType}).",
                    ]);

                    $order->printJobs()->createMany([
                        ['document_type' => 'invoice', 'destination' => 'cashier', 'status' => 'MENUNGGU'],
                        ['document_type' => 'kot', 'destination' => 'kitchen_bar', 'status' => 'MENUNGGU'],
                    ]);
                }
            } elseif ($isFailed) {
                if ($order->order_status !== 'DIBATALKAN') {
                    $order->update([
                        'payment_status' => 'GAGAL',
                        'order_status' => 'DIBATALKAN',
                        'cancelled_at' => $now,
                    ]);
                    $order->refundRedeemedPointsIfCancelled();

                    if ($payment) {
                        $payment->update([
                            'status' => $transactionStatus === 'expire' ? 'KADALUARSA' : 'GAGAL',
                            'provider_metadata' => $request->all(),
                        ]);
                    }

                    $order->statusHistory()->create([
                        'from_status' => $order->order_status,
                        'to_status' => 'DIBATALKAN',
                        'reason' => "Pembayaran Midtrans {$transactionStatus}.",
                    ]);
                }
            }
        });

        return response()->json([
            'message' => 'Notifikasi Midtrans berhasil diproses.',
            'order_status' => $order->fresh()->order_status,
            'payment_status' => $order->fresh()->payment_status,
        ]);
    }
}

