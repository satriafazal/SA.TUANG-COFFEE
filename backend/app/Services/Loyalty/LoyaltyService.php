<?php

namespace App\Services\Loyalty;

use App\Models\LoyaltyRule;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LoyaltyService
{
    public const DEFAULT_SETTINGS = [
        'is_active' => true,
        'earning_threshold' => 10000,
        'point_value_rupiah' => 500,
        'min_redemption_points' => 5,
        'max_discount_percentage' => 50,
    ];

    public function getActiveSettings(): array
    {
        $rule = LoyaltyRule::query()
            ->where('rule_type', 'general')
            ->orderByDesc('version')
            ->first();

        if (! $rule) {
            return self::DEFAULT_SETTINGS;
        }

        $config = $rule->configuration ?? [];

        return [
            'is_active' => (bool) ($rule->is_active ?? true),
            'earning_threshold' => (int) ($config['earning_threshold'] ?? self::DEFAULT_SETTINGS['earning_threshold']),
            'point_value_rupiah' => (int) ($config['point_value_rupiah'] ?? self::DEFAULT_SETTINGS['point_value_rupiah']),
            'min_redemption_points' => (int) ($config['min_redemption_points'] ?? self::DEFAULT_SETTINGS['min_redemption_points']),
            'max_discount_percentage' => (int) ($config['max_discount_percentage'] ?? self::DEFAULT_SETTINGS['max_discount_percentage']),
        ];
    }

    public function updateSettings(array $data, ?int $userId = null): array
    {
        return DB::transaction(function () use ($data, $userId): array {
            $existing = LoyaltyRule::query()
                ->where('rule_type', 'general')
                ->lockForUpdate()
                ->orderByDesc('version')
                ->first();

            $version = $existing ? $existing->version + 1 : 1;
            $isActive = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true;

            $configuration = [
                'earning_threshold' => max(1000, (int) ($data['earning_threshold'] ?? self::DEFAULT_SETTINGS['earning_threshold'])),
                'point_value_rupiah' => max(1, (int) ($data['point_value_rupiah'] ?? self::DEFAULT_SETTINGS['point_value_rupiah'])),
                'min_redemption_points' => max(1, (int) ($data['min_redemption_points'] ?? self::DEFAULT_SETTINGS['min_redemption_points'])),
                'max_discount_percentage' => min(100, max(1, (int) ($data['max_discount_percentage'] ?? self::DEFAULT_SETTINGS['max_discount_percentage']))),
            ];

            if ($existing) {
                $existing->update([
                    'configuration' => $configuration,
                    'is_active' => $isActive,
                    'created_by' => $userId ?? $existing->created_by,
                ]);
            } else {
                LoyaltyRule::create([
                    'rule_type' => 'general',
                    'version' => $version,
                    'name' => 'Skema Poin Loyalitas Member',
                    'configuration' => $configuration,
                    'is_active' => $isActive,
                    'created_by' => $userId,
                ]);
            }

            return array_merge(['is_active' => $isActive], $configuration);
        }, 3);
    }

    public function calculateEarnedPoints(float $orderTotal): int
    {
        $settings = $this->getActiveSettings();
        if (! $settings['is_active'] || $settings['earning_threshold'] <= 0) {
            return 0;
        }

        return max(0, (int) floor($orderTotal / $settings['earning_threshold']));
    }

    public function calculateRedemptionDiscount(int $pointsRedeemed, float $subtotal): array
    {
        $settings = $this->getActiveSettings();

        if (! $settings['is_active']) {
            throw ValidationException::withMessages([
                'points_redeemed' => 'Program poin loyalitas sedang tidak aktif.',
            ]);
        }

        if ($pointsRedeemed < $settings['min_redemption_points']) {
            throw ValidationException::withMessages([
                'points_redeemed' => "Minimal penukaran poin adalah {$settings['min_redemption_points']} poin.",
            ]);
        }

        $nominalDiscount = $pointsRedeemed * $settings['point_value_rupiah'];
        $maxDiscount = ($settings['max_discount_percentage'] / 100) * $subtotal;

        $actualDiscount = min($nominalDiscount, $maxDiscount, $subtotal);

        return [
            'points_used' => $pointsRedeemed,
            'discount_amount' => $actualDiscount,
            'point_value_rupiah' => $settings['point_value_rupiah'],
        ];
    }
}
