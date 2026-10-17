<?php

use App\Http\Controllers\Api\V1\AdminCatalogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashierOrderController;
use App\Http\Controllers\Api\V1\MenuController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\TrackOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/menu', [MenuController::class, 'index'])->name('api.v1.menu.index');
    Route::post('/orders', [OrderController::class, 'store'])->name('api.v1.orders.store');
    Route::post('/promotions/validate', [OrderController::class, 'validatePromo'])->name('api.v1.promotions.validate');
    Route::get('/orders/{orderNumber}/status', [TrackOrderController::class, 'show'])->name('api.v1.orders.status');

    Route::post('/auth/login', [AuthController::class, 'login'])->name('api.v1.auth.login');
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
    });

    Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin'])->group(function (): void {
        Route::get('/dashboard', [AdminCatalogController::class, 'dashboard'])->name('api.v1.admin.dashboard');
        Route::get('/categories', [AdminCatalogController::class, 'categories'])->name('api.v1.admin.categories.index');
        Route::post('/categories', [AdminCatalogController::class, 'storeCategory'])->name('api.v1.admin.categories.store');
        Route::put('/categories/{categoryId}', [AdminCatalogController::class, 'updateCategory'])->name('api.v1.admin.categories.update');
        Route::delete('/categories/{categoryId}', [AdminCatalogController::class, 'destroyCategory'])->name('api.v1.admin.categories.destroy');
        Route::get('/products', [AdminCatalogController::class, 'products'])->name('api.v1.admin.products.index');
        Route::post('/products', [AdminCatalogController::class, 'storeProduct'])->name('api.v1.admin.products.store');
        Route::put('/products/{productId}', [AdminCatalogController::class, 'updateProduct'])->name('api.v1.admin.products.update');
        Route::delete('/products/{productId}', [AdminCatalogController::class, 'destroyProduct'])->name('api.v1.admin.products.destroy');
        Route::post('/upload', [AdminCatalogController::class, 'uploadImage'])->name('api.v1.admin.upload');
        Route::post('/import-url', [AdminCatalogController::class, 'importImageUrl'])->name('api.v1.admin.import-url');

        Route::get('/bundles', [AdminCatalogController::class, 'bundles'])->name('api.v1.admin.bundles.index');
        Route::post('/bundles', [AdminCatalogController::class, 'storeBundle'])->name('api.v1.admin.bundles.store');
        Route::put('/bundles/{bundleId}', [AdminCatalogController::class, 'updateBundle'])->name('api.v1.admin.bundles.update');
        Route::delete('/bundles/{bundleId}', [AdminCatalogController::class, 'destroyBundle'])->name('api.v1.admin.bundles.destroy');

        Route::get('/promotions', [AdminCatalogController::class, 'promotions'])->name('api.v1.admin.promotions.index');
        Route::post('/promotions', [AdminCatalogController::class, 'storePromotion'])->name('api.v1.admin.promotions.store');
        Route::put('/promotions/{promotionId}', [AdminCatalogController::class, 'updatePromotion'])->name('api.v1.admin.promotions.update');
        Route::delete('/promotions/{promotionId}', [AdminCatalogController::class, 'destroyPromotion'])->name('api.v1.admin.promotions.destroy');

        Route::get('/banners', [AdminCatalogController::class, 'banners'])->name('api.v1.admin.banners.index');
        Route::post('/banners', [AdminCatalogController::class, 'storeBanner'])->name('api.v1.admin.banners.store');
        Route::put('/banners/{bannerId}', [AdminCatalogController::class, 'updateBanner'])->name('api.v1.admin.banners.update');
        Route::delete('/banners/{bannerId}', [AdminCatalogController::class, 'destroyBanner'])->name('api.v1.admin.banners.destroy');

        Route::get('/staff', [AdminCatalogController::class, 'staff'])->name('api.v1.admin.staff.index');
        Route::post('/staff', [AdminCatalogController::class, 'storeStaff'])->name('api.v1.admin.staff.store');
        Route::put('/staff/{userId}', [AdminCatalogController::class, 'updateStaff'])->name('api.v1.admin.staff.update');
        Route::patch('/staff/{userId}/toggle-status', [AdminCatalogController::class, 'toggleStaffStatus'])->name('api.v1.admin.staff.toggle-status');

        Route::get('/orders', [AdminCatalogController::class, 'orders'])->name('api.v1.admin.orders.index');
        Route::get('/audit-logs', [AdminCatalogController::class, 'auditLogs'])->name('api.v1.admin.audit-logs.index');
    });
    Route::prefix('cashier')->middleware(['auth:sanctum', 'role:cashier,admin'])->group(function (): void {
        Route::get('/products', [CashierOrderController::class, 'products'])->name('api.v1.cashier.products.index');
        Route::patch('/products/{productId}/availability', [CashierOrderController::class, 'updateProductAvailability'])->name('api.v1.cashier.products.availability');
        Route::patch('/bundles/{bundleId}/availability', [CashierOrderController::class, 'updateBundleAvailability'])->name('api.v1.cashier.bundles.availability');
        Route::get('/orders', [CashierOrderController::class, 'index'])->name('api.v1.cashier.orders.index');
        Route::get('/orders/completed', [CashierOrderController::class, 'completed'])->name('api.v1.cashier.orders.completed');
        Route::post('/orders/{orderNumber}/confirm-payment', [CashierOrderController::class, 'confirmPayment'])->name('api.v1.cashier.orders.confirm-payment');
        Route::patch('/orders/{orderNumber}/preparation-groups', [CashierOrderController::class, 'updatePreparationGroupStatus'])->name('api.v1.cashier.preparation-groups.update');
        Route::post('/orders/{orderNumber}/complete', [CashierOrderController::class, 'complete'])->name('api.v1.cashier.orders.complete');
    });
});
