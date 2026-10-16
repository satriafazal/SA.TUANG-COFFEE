<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class AdminUserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_an_active_admin_and_is_safe_to_rerun(): void
    {
        Config::set('services.admin_seed.name', 'Administrator Utama');
        Config::set('services.admin_seed.email', 'admin.utama@satuang.test');
        Config::set('services.admin_seed.password', 'AdminSecret1234!');

        $this->seed(AdminUserSeeder::class);

        $admin = User::query()->where('email', 'admin.utama@satuang.test')->first();
        $this->assertNotNull($admin);
        $this->assertSame('Administrator Utama', $admin->name);
        $this->assertSame('admin', $admin->role);
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check('AdminSecret1234!', $admin->password));

        // Rerun seeder safely
        $this->seed(AdminUserSeeder::class);
        $this->assertSame(1, User::query()->where('email', 'admin.utama@satuang.test')->count());
    }

    public function test_seeder_refuses_missing_configuration(): void
    {
        Config::set('services.admin_seed.name', null);
        Config::set('services.admin_seed.email', null);
        Config::set('services.admin_seed.password', null);

        $this->expectException(RuntimeException::class);
        $this->seed(AdminUserSeeder::class);
    }
}
