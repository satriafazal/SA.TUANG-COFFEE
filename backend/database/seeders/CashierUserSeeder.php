<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use RuntimeException;

class CashierUserSeeder extends Seeder
{
    public function run(): void
    {
        $name = trim((string) config('services.cashier_seed.name'));
        $email = mb_strtolower(trim((string) config('services.cashier_seed.email')));
        $password = (string) config('services.cashier_seed.password');

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
        ], [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', Password::min(12)],
        ]);

        if ($validator->fails()) {
            throw new RuntimeException('Konfigurasi Cashier belum lengkap atau tidak valid. Atur CASHIER_SEED_NAME, CASHIER_SEED_EMAIL, dan CASHIER_SEED_PASSWORD melalui environment/secret manager; kata sandi minimal 12 karakter.');
        }

        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            if ($existing->role === 'cashier' && $existing->is_active) {
                return;
            }

            throw new RuntimeException('Email staf sudah digunakan oleh akun lain; seeder tidak mengubah akun yang ada.');
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
