<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class MemberAuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'string', 'email', 'max:180', 'unique:customers,email'],
            'phone' => ['required', 'string', 'regex:/^08[0-9]{8,12}$/', 'unique:customers,phone'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'email.unique' => 'Alamat email ini sudah terdaftar sebagai Member.',
            'phone.unique' => 'Nomor WhatsApp/HP ini sudah terdaftar sebagai Member.',
            'phone.regex' => 'Format nomor HP tidak valid. Gunakan format Indonesia yang diawali 08 (contoh: 08123456789).',
            'password.min' => 'Kata sandi minimal 8 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi belum cocok.',
        ]);

        $customer = Customer::create([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'phone' => trim($data['phone']),
            'password' => $data['password'],
            'points_balance' => 0,
        ]);

        $token = $customer->createToken('customer-auth')->plainTextToken;

        return response()->json([
            'token' => $token,
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'points_balance' => $customer->points_balance,
            ],
            'message' => 'Pendaftaran Member berhasil! Selamat bergabung di SA.TUANG COFFEE.',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:180'],
            'password' => ['required', 'string', 'min:8'],
        ], [
            'identifier.required' => 'Masukkan email atau nomor HP Anda.',
            'password.required' => 'Masukkan kata sandi akun Member Anda.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
        ]);

        $key = 'customer-login:'.strtolower(trim($data['identifier'])).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat.'], 429);
        }

        $identifier = trim($data['identifier']);
        /** @var Customer|null $customer */
        $customer = Customer::query()
            ->where('email', strtolower($identifier))
            ->orWhere('phone', $identifier)
            ->first();

        if (!$customer || !Hash::check($data['password'], $customer->password)) {
            RateLimiter::hit($key, 60);
            return response()->json(['message' => 'Email/Nomor HP atau kata sandi tidak cocok.'], 422);
        }

        RateLimiter::clear($key);
        $token = $customer->createToken('customer-auth')->plainTextToken;

        return response()->json([
            'token' => $token,
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'points_balance' => $customer->points_balance,
            ],
            'message' => 'Selamat datang kembali, '.$customer->name.'!',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!($user instanceof Customer)) {
            return response()->json(['message' => 'Sesi Member tidak valid.'], 401);
        }

        return response()->json([
            'customer' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'points_balance' => $user->points_balance,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Sesi Member berhasil diakhiri.']);
    }
}
