<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\CashierUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class CashierUserSeederTest extends TestCase
{
    use RefreshDatabase;

    private function configureCashierSeed(?string $email, ?string $password, ?string $name = 'Kasir SA.TUANG'): void
    {
        config([
            'services.cashier_seed.name' => $name,
            'services.cashier_seed.email' => $email,
            'services.cashier_seed.password' => $password,
        ]);
    }

    public function test_seeder_creates_default_active_cashier_without_config_and_is_safe_to_rerun(): void
    {
        $this->configureCashierSeed(null, null, null);

        $this->seed(CashierUserSeeder::class);
        $user = User::query()->where('email', 'kasir@satuang.test')->firstOrFail();

        $this->assertSame('Kasir SA.TUANG', $user->name);
        $this->assertSame('cashier', $user->role);
        $this->assertTrue($user->is_active);
        $this->assertTrue(Hash::check('kasir123', $user->password));

        // Rerun seeder safely
        $this->seed(CashierUserSeeder::class);
        $this->assertSame(1, User::query()->where('email', 'kasir@satuang.test')->count());
    }

    public function test_seeder_uses_custom_configuration_when_provided(): void
    {
        $email = 'cashier-'.Str::uuid().'@example.invalid';
        $password = 'customSecretPass123';
        $this->configureCashierSeed($email, $password, 'Kasir Khusus');

        $this->seed(CashierUserSeeder::class);
        $user = User::query()->where('email', $email)->firstOrFail();

        $this->assertSame('Kasir Khusus', $user->name);
        $this->assertSame('cashier', $user->role);
        $this->assertTrue($user->is_active);
        $this->assertTrue(Hash::check($password, $user->password));
    }

    public function test_seeder_does_not_modify_an_existing_non_cashier_account(): void
    {
        $email = 'existing-'.Str::uuid().'@example.invalid';
        $member = User::factory()->create(['email' => $email, 'role' => 'member', 'is_active' => true]);
        $this->configureCashierSeed($email, 'password123');

        try {
            $this->seed(CashierUserSeeder::class);
            $this->fail('Seeder should not change the role of an existing account.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('sudah digunakan', $exception->getMessage());
        }

        $this->assertSame('member', $member->fresh()->role);
        $this->assertDatabaseCount('users', 1);
    }
}
