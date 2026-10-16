<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StaffAuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_login_and_receive_a_token_for_their_role(): void
    {
        User::factory()->create([
            'name' => 'Kasir Uji',
            'email' => 'cashier@example.test',
            'password' => Hash::make('testing-password'),
            'role' => 'cashier',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'cashier@example.test',
            'password' => 'testing-password',
        ])->assertOk()->assertJsonPath('user.role', 'cashier');

        $this->withHeader('Authorization', 'Bearer '.$response->json('token'))
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'cashier@example.test');
    }

    public function test_inactive_staff_cannot_login(): void
    {
        User::factory()->create([
            'email' => 'inactive@example.test',
            'password' => Hash::make('testing-password'),
            'role' => 'cashier',
            'is_active' => false,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'inactive@example.test',
            'password' => 'testing-password',
        ])->assertUnprocessable();
    }
}
