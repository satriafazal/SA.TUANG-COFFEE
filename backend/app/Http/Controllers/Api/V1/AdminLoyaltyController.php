<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Loyalty\LoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminLoyaltyController extends Controller
{
    public function __construct(
        protected LoyaltyService $loyaltyService
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'settings' => $this->loyaltyService->getActiveSettings(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
            'earning_threshold' => ['required', 'integer', 'min:1000', 'max:1000000'],
            'point_value_rupiah' => ['required', 'integer', 'min:1', 'max:100000', 'lt:earning_threshold'],
            'min_redemption_points' => ['required', 'integer', 'min:1', 'max:1000'],
            'max_discount_percentage' => ['required', 'integer', 'min:1', 'max:100'],
        ], [
            'point_value_rupiah.lt' => 'Nilai tukar 1 poin tidak boleh sama atau melebihi ambang belanja per 1 poin demi menjaga margin keuangan kafe.',
            'earning_threshold.min' => 'Ambang belanja minimal adalah Rp 1.000 per 1 poin.',
            'max_discount_percentage.max' => 'Maksimal potongan diskon poin tidak boleh melebihi 100%.',
        ]);

        $settings = $this->loyaltyService->updateSettings($data, $request->user()?->id);

        DB::table('audit_logs')->insert([
            'actor_id' => $request->user()->id,
            'action' => 'admin.loyalty.updated',
            'subject_type' => 'loyalty_rules',
            'subject_id' => 'general',
            'before_snapshot' => null,
            'after_snapshot' => json_encode($settings, JSON_THROW_ON_ERROR),
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Pengaturan skema loyalitas berhasil diperbarui.',
            'settings' => $settings,
        ]);
    }
}

