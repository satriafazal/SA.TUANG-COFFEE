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

    private function configureCashierSeed(string $email, string $password): void
    {
        config([
            'services.cashier_seed.name' => 'Kasir SA.TUANG',
            'services.cashier_seed.email' => $email,
            'services.cashier_seed.password' => $password,
        ]);
    }

    public function test_seeder_creates_an_active_cashier_and_is_safe_to_rerun(): void
    {
        $email = 'cashier-'.Str::uuid().'@example.invalid';
        $password = Str::password(32);
        $this->configureCashierSeed($email, $password);

        $this->seed(CashierUserSeeder::class);
        $user = User::query()->where('email', $email)->firstOrFail();

        $this->assertSame('cashier', $user->role);
        $this->assertTrue($user->is_active);
        $this->assertTrue(Hash::check($password, $user->password));

        $replacementPassword = Str::password(32);
        $this->configureCashierSeed($email, $replacementPassword);
        $this->seed(CashierUserSeeder::class);

        $this->assertDatabaseCount('users', 1);
        $this->assertTrue(Hash::check($password, $user->fresh()->password));
        $this->assertFalse(Hash::check($replacementPassword, $user->fresh()->password));
    }

    public function test_seeder_refuses_missing_configuration_without_creating_a_user(): void
    {
        config([
            'services.cashier_seed.name' => null,
            'services.cashier_seed.email' => null,
            'services.cashier_seed.password' => null,
        ]);

        try {
            $this->seed(CashierUserSeeder::class);
            $this->fail('Seeder should require staff account values from protected environment configuration.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('CASHIER_SEED_', $exception->getMessage());
        }

        $this->assertDatabaseCount('users', 0);
    }

    public function test_seeder_does_not_modify_an_existing_non_cashier_account(): void
    {
        $email = 'existing-'.Str::uuid().'@example.invalid';
        $member = User::factory()->create(['email' => $email, 'role' => 'member', 'is_active' => true]);
        $this->configureCashierSeed($email, Str::password(32));

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
