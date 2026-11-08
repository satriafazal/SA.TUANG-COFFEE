<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'order_number', 'daily_ticket_number', 'user_id', 'customer_id', 'guest_device_token',
        'customer_name', 'customer_phone', 'order_status',
        'payment_status', 'payment_method', 'subtotal', 'discount_total',
        'points_discount', 'total', 'points_redeemed', 'pricing_snapshot',
        'idempotency_key', 'confirmed_at', 'completed_at', 'cancelled_at', 'expires_at',
    ];

    protected $appends = ['snap_token', 'snap_redirect_url'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'points_discount' => 'decimal:2',
            'total' => 'decimal:2',
            'points_redeemed' => 'integer',
            'pricing_snapshot' => 'array',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function printJobs(): HasMany
    {
        return $this->hasMany(PrintJob::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getSnapTokenAttribute(): ?string
    {
        if ($this->relationLoaded('payments')) {
            $payment = $this->payments
                ->where('provider', 'midtrans')
                ->where('status', 'MENUNGGU')
                ->first();

            return $payment?->provider_reference;
        }

        return null;
    }

    public function getSnapRedirectUrlAttribute(): ?string
    {
        if ($this->relationLoaded('payments')) {
            $payment = $this->payments
                ->where('provider', 'midtrans')
                ->where('status', 'MENUNGGU')
                ->first();

            return $payment?->provider_metadata['redirect_url']
                ?? $payment?->provider_metadata['snap_redirect_url']
                ?? null;
        }

        return null;
    }

    public function refundRedeemedPointsIfCancelled(): bool
    {
        if ($this->points_redeemed > 0 && $this->customer_id) {
            $snapshot = $this->pricing_snapshot ?? [];
            if (!empty($snapshot['loyalty']['points_refunded'])) {
                return false;
            }

            $customer = Customer::query()->where('id', $this->customer_id)->lockForUpdate()->first();
            if ($customer) {
                $customer->increment('points_balance', $this->points_redeemed);

                $snapshot['loyalty']['points_refunded'] = true;
                $snapshot['loyalty']['points_refunded_at'] = now()->toISOString();
                $this->update(['pricing_snapshot' => $snapshot]);

                $this->statusHistory()->create([
                    'from_status' => $this->order_status,
                    'to_status' => 'DIBATALKAN',
                    'reason' => "Pengembalian {$this->points_redeemed} poin loyalitas karena pesanan dibatalkan/kedaluwarsa.",
                ]);

                return true;
            }
        }

        return false;
    }

    public static function expirePendingOrders(): int
    {
        $expired = static::query()
            ->where('order_status', 'MENUNGGU_PEMBAYARAN')
            ->where('payment_status', 'MENUNGGU')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->get();

        $count = 0;
        foreach ($expired as $order) {
            $order->update([
                'order_status' => 'DIBATALKAN',
                'cancelled_at' => now(),
            ]);
            $order->refundRedeemedPointsIfCancelled();
            $count++;
        }

        return $count;
    }
}
