import { NextRequest } from 'next/server';
import { withManager } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import type { JWTPayload } from '@/lib/auth';
import { getClinicStats } from '@/lib/analytics-queries';

type HandlerContext = { user: JWTPayload };

// GET /api/analytics/clinics - Get clinic performance list
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = request.nextUrl;
    const province = searchParams.get('province') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sortBy = searchParams.get('sortBy') || 'activationRate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Fetch clinic stats
    let clinics = await getClinicStats({
      province,
      startDate,
      endDate,
    });

    // Sort clinics
    clinics.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'province':
          compareValue = a.province.localeCompare(b.province);
          break;
        case 'totalShipped':
          compareValue = a.totalShipped - b.totalShipped;
          break;
        case 'totalActivated':
          compareValue = a.totalActivated - b.totalActivated;
          break;
        case 'activationRate':
          compareValue = a.activationRate - b.activationRate;
          break;
        case 'avgDaysToActivation':
          const aAvg = a.avgDaysToActivation || 999;
          const bAvg = b.avgDaysToActivation || 999;
          compareValue = aAvg - bAvg;
          break;
        case 'lastActivationDate':
          const aDate = a.lastActivationDate ? new Date(a.lastActivationDate).getTime() : 0;
          const bDate = b.lastActivationDate ? new Date(b.lastActivationDate).getTime() : 0;
          compareValue = aDate - bDate;
          break;
        default:
          compareValue = a.activationRate - b.activationRate;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    // Get unique provinces for filter dropdown
    const provinces = Array.from(new Set(clinics.map(c => c.province))).sort();

    return successResponse({
      clinics,
      provinces,
      totalClinics: clinics.length,
    });
  } catch (error) {
    console.error('Clinic analytics error:', error);
    return errors.internalError();
  }
}

export const GET = withManager(handleGET);
