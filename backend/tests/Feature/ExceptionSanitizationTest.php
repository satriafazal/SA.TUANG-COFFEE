<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExceptionSanitizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tracking_nonexistent_order_returns_sanitized_message(): void
    {
        $response = $this->getJson('/api/v1/orders/ST-NONEXISTENT-999/status?customer_name=Budi');

        $response->assertStatus(404);
        $response->assertJson([
            'message' => 'Data pesanan tidak ditemukan.',
        ]);
        $this->assertStringNotContainsString('No query results for model', (string) $response->getContent());
        $this->assertStringNotContainsString('App\\Models', (string) $response->getContent());
    }

    public function test_nonexistent_cashier_product_returns_sanitized_message(): void
    {
        $cashier = User::factory()->create([
            'role' => 'cashier',
            'is_active' => true,
        ]);

        Sanctum::actingAs($cashier, ['*']);

        $response = $this->patchJson('/api/v1/cashier/products/999999/availability', [
            'is_available' => false,
        ]);

        $response->assertStatus(404);
        $response->assertJson([
            'message' => 'Data menu tidak ditemukan.',
        ]);
        $this->assertStringNotContainsString('No query results for model', (string) $response->getContent());
        $this->assertStringNotContainsString('App\\Models', (string) $response->getContent());
    }

    public function test_invalid_api_route_returns_sanitized_message(): void
    {
        $response = $this->getJson('/api/v1/route-yang-pasti-tidak-ada-12345');

        $response->assertStatus(404);
        $response->assertJson([
            'message' => 'Endpoint atau data yang dicari tidak ditemukan.',
        ]);
        $this->assertStringNotContainsString('No query results for model', (string) $response->getContent());
        $this->assertStringNotContainsString('App\\Models', (string) $response->getContent());
    }
}

