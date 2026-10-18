<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $name = 'Member Demo SA.TUANG';
        $email = 'member@satuang.test';
        $phone = '081234567890';
        $password = 'member123';
        $points = 250;

        $existing = Customer::query()->where('phone', $phone)->orWhere('email', $email)->first();
        if ($existing) {
            $existing->update([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'password' => Hash::make($password),
                'points_balance' => $points,
            ]);
            return;
        }

        Customer::query()->create([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => Hash::make($password),
            'points_balance' => $points,
        ]);
    }
}
