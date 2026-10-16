<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CoreSchemaTest extends TestCase
{
    use \Illuminate\Foundation\Testing\RefreshDatabase;

    public function test_core_order_and_catalog_tables_exist(): void
    {
        foreach ([
            'categories',
            'products',
            'orders',
            'order_items',
            'payments',
            'order_status_histories',
            'loyalty_rules',
            'loyalty_ledger_entries',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Expected table [{$table}] to exist.");
        }
    }

    public function test_orders_keep_payment_and_fulfillment_status_separate(): void
    {
        $this->assertTrue(Schema::hasColumns('orders', [
            'payment_status',
            'order_status',
            'order_number',
            'customer_name',
        ]));
    }

    public function test_order_items_can_track_food_and_drink_independently(): void
    {
        $this->assertTrue(Schema::hasColumns('order_items', [
            'item_type',
            'preparation_status',
        ]));
    }

    public function test_loyalty_entries_capture_rule_snapshot_and_adjustment_audit(): void
    {
        $this->assertTrue(Schema::hasColumns('loyalty_ledger_entries', [
            'entry_type',
            'points_delta',
            'rule_snapshot',
            'reason',
            'actor_id',
            'order_id',
        ]));
    }
}
