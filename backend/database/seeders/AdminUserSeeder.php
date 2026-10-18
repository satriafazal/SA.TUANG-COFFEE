<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $name = config('services.admin_seed.name') ?: 'Admin SA.TUANG';
        $email = mb_strtolower(trim((string) (config('services.admin_seed.email') ?: 'admin@satuang.test')));
        $password = config('services.admin_seed.password') ?: 'admin123';

        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            $existing->update([
                'name' => $name,
                'password' => Hash::make($password),
                'role' => 'admin',
                'is_active' => true,
            ]);
            return;
        }

        User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'admin',
            'is_active' => true,
        ]);
    }
}
