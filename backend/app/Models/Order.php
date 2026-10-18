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
}
