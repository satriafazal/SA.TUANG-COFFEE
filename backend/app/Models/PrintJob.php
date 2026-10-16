<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintJob extends Model
{
    protected $fillable = [
        'order_id', 'retry_of_id', 'document_type', 'destination', 'status',
        'attempt_count', 'last_error', 'printed_at',
    ];

    protected function casts(): array
    {
        return [
            'attempt_count' => 'integer',
            'printed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
