<?php

use App\Http\Middleware\EnsureRole;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['role' => EnsureRole::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $resolveModelMessage = function (string $modelClass): string {
            return match ($modelClass) {
                'Order' => 'Data pesanan tidak ditemukan.',
                'OrderItem' => 'Item pesanan tidak ditemukan.',
                'Product' => 'Data menu tidak ditemukan.',
                'Category' => 'Data kategori tidak ditemukan.',
                'Promotion' => 'Data promo tidak ditemukan.',
                'Bundle' => 'Data paket menu tidak ditemukan.',
                'BundleComponent' => 'Data komponen paket menu tidak ditemukan.',
                'Banner' => 'Data banner tidak ditemukan.',
                'User' => 'Data akun pengguna atau staf tidak ditemukan.',
                'Customer' => 'Data member atau pelanggan tidak ditemukan.',
                'LoyaltyRule' => 'Data pengaturan poin tidak ditemukan.',
                'Payment' => 'Data pembayaran tidak ditemukan.',
                'PrintJob' => 'Data antrean cetak tidak ditemukan.',
                default => 'Data yang dicari tidak ditemukan.',
            };
        };

        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($resolveModelMessage) {
            if ($request->is('api/*') || $request->wantsJson() || $request->ajax()) {
                $previous = $e->getPrevious();
                $message = 'Endpoint atau data yang dicari tidak ditemukan.';

                if ($previous instanceof ModelNotFoundException) {
                    $modelClass = class_basename($previous->getModel());
                    $message = $resolveModelMessage($modelClass);
                } elseif (preg_match('/No query results for model \[([^\]]+)\]/', $e->getMessage(), $matches)) {
                    $modelClass = class_basename($matches[1]);
                    $message = $resolveModelMessage($modelClass);
                }

                return response()->json([
                    'message' => $message,
                ], 404);
            }
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) use ($resolveModelMessage) {
            if ($request->is('api/*') || $request->wantsJson() || $request->ajax()) {
                $modelClass = class_basename($e->getModel());
                return response()->json([
                    'message' => $resolveModelMessage($modelClass),
                ], 404);
            }
        });
    })->create();
