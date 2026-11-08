<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Loyalty\LoyaltyService;
use Illuminate\Http\JsonResponse;

class LoyaltyController extends Controller
{
    public function __construct(
        protected LoyaltyService $loyaltyService
    ) {}

    public function settings(): JsonResponse
    {
        return response()->json([
            'settings' => $this->loyaltyService->getActiveSettings(),
        ]);
    }
}

