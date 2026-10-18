<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class CashierUserSeeder extends Seeder
{
    public function run(): void
    {
        $name = config('services.cashier_seed.name') ?: 'Kasir SA.TUANG';
        $email = mb_strtolower(trim((string) (config('services.cashier_seed.email') ?: 'kasir@satuang.test')));
        $password = config('services.cashier_seed.password') ?: 'kasir123';

        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            if ($existing->role !== 'cashier') {
                throw new RuntimeException('Email staf sudah digunakan oleh akun lain; seeder tidak mengubah akun yang ada.');
            }

            $existing->update([
                'name' => $name,
                'password' => Hash::make($password),
                'role' => 'cashier',
                'is_active' => true,
            ]);
            return;
        }

        User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'cashier',
            'is_active' => true,
        ]);
    }
}
