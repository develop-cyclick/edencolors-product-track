import { NextRequest } from 'next/server';
import { withManager } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import type { JWTPayload } from '@/lib/auth';
import {
  getOverviewStats,
  getActivationTrend,
  getCategoryStats,
  getTopClinics,
  getProvinceDistribution,
  getRecentActivations,
} from '@/lib/analytics-queries';

type HandlerContext = { user: JWTPayload };

// In-memory cache with 5-minute TTL
let cache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET /api/analytics/overview - Get overview analytics dashboard data
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = request.nextUrl;
    const trendDays = parseInt(searchParams.get('trendDays') || '30');

    // Check cache
    const now = Date.now();
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return successResponse(cache.data);
    }

    // Fetch all data in parallel for better performance
    const [
      stats,
      trend,
      categories,
      topClinics,
      provinceDistribution,
      recentActivations,
    ] = await Promise.all([
      getOverviewStats(),
      getActivationTrend(trendDays),
      getCategoryStats(),
      getTopClinics(10),
      getProvinceDistribution(),
      getRecentActivations(10),
    ]);

    const responseData = {
      stats,
      trend,
      categories,
      topClinics,
      provinceDistribution,
      recentActivations,
    };

    // Update cache
    cache = {
      data: responseData,
      timestamp: now,
    };

    return successResponse(responseData);
  } catch (error) {
    console.error('Analytics overview error:', error);
    return errors.internalError();
  }
}

export const GET = withManager(handleGET);
