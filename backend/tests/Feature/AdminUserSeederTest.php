<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminUserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_default_active_admin_without_config_and_is_safe_to_rerun(): void
    {
        Config::set('services.admin_seed.name', null);
        Config::set('services.admin_seed.email', null);
        Config::set('services.admin_seed.password', null);

        $this->seed(AdminUserSeeder::class);

        $admin = User::query()->where('email', 'admin@satuang.test')->first();
        $this->assertNotNull($admin);
        $this->assertSame('Admin SA.TUANG', $admin->name);
        $this->assertSame('admin', $admin->role);
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check('admin123', $admin->password));

        // Rerun seeder safely
        $this->seed(AdminUserSeeder::class);
        $this->assertSame(1, User::query()->where('email', 'admin@satuang.test')->count());
    }

    public function test_seeder_uses_custom_configuration_when_provided(): void
    {
        Config::set('services.admin_seed.name', 'Administrator Khusus');
        Config::set('services.admin_seed.email', 'custom.admin@satuang.test');
        Config::set('services.admin_seed.password', 'CustomAdminPass123!');

        $this->seed(AdminUserSeeder::class);

        $admin = User::query()->where('email', 'custom.admin@satuang.test')->first();
        $this->assertNotNull($admin);
        $this->assertSame('Administrator Khusus', $admin->name);
        $this->assertSame('admin', $admin->role);
        $this->assertTrue(Hash::check('CustomAdminPass123!', $admin->password));
    }
}
