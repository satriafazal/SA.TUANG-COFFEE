<?php

namespace Tests\Feature;

use App\Models\Customer;
use Database\Seeders\CustomerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_seeder_creates_demo_member_and_is_safe_to_rerun(): void
    {
        $this->seed(CustomerSeeder::class);

        $customer = Customer::query()->where('phone', '081234567890')->first();
        $this->assertNotNull($customer);
        $this->assertSame('Member Demo SA.TUANG', $customer->name);
        $this->assertSame('member@satuang.test', $customer->email);
        $this->assertSame('081234567890', $customer->phone);
        $this->assertSame(250, $customer->points_balance);
        $this->assertTrue(Hash::check('member123', $customer->password));

        // Rerun seeder safely
        $this->seed(CustomerSeeder::class);
        $this->assertSame(1, Customer::query()->where('phone', '081234567890')->count());
    }
}
