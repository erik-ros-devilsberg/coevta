<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * Unauthenticated liveness check for the API.
 */
class HealthController extends Controller
{
	public function __invoke(): JsonResponse
	{
		return response()->json([
			'status' => 'ok',
			// RFC 3339 / ISO 8601 in UTC (trailing Z) — Google-compatible.
			'time' => Carbon::now('UTC')->toIso8601ZuluString('microsecond'),
		]);
	}
}
