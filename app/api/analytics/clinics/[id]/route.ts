import { NextRequest } from 'next/server';
import { withManager } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import type { JWTPayload } from '@/lib/auth';
import { getClinicDetail } from '@/lib/analytics-queries';

type HandlerContext = {
  user: JWTPayload;
  params?: Promise<{ id: string }>;
};

// GET /api/analytics/clinics/[id] - Get specific clinic details
async function handleGET(
  request: NextRequest,
  context: HandlerContext
) {
  try {
    if (!context.params) {
      return errors.badRequest('Missing clinic ID');
    }
    const params = await context.params;
    const clinicId = parseInt(params.id);

    if (isNaN(clinicId)) {
      return errors.badRequest('Invalid clinic ID');
    }

    const clinicData = await getClinicDetail(clinicId);

    if (!clinicData) {
      return errors.notFound('Clinic not found');
    }

    // Calculate demographic stats from activations
    const demographics = {
      gender: {
        male: 0,
        female: 0,
        other: 0,
      },
      ageGroups: {
        '0-18': 0,
        '19-30': 0,
        '31-45': 0,
        '46-60': 0,
        '60+': 0,
      },
    };

    // Process all activations to calculate demographics
    clinicData.productItems.forEach((item) => {
      item.activations.forEach((activation) => {
        // Gender distribution
        if (activation.gender === 'M') {
          demographics.gender.male++;
        } else if (activation.gender === 'F') {
          demographics.gender.female++;
        } else {
          demographics.gender.other++;
        }

        // Age groups
        if (activation.age !== null) {
          if (activation.age <= 18) {
            demographics.ageGroups['0-18']++;
          } else if (activation.age <= 30) {
            demographics.ageGroups['19-30']++;
          } else if (activation.age <= 45) {
            demographics.ageGroups['31-45']++;
          } else if (activation.age <= 60) {
            demographics.ageGroups['46-60']++;
          } else {
            demographics.ageGroups['60+']++;
          }
        }
      });
    });

    // Calculate days to activation for each product item
    const productsWithDays = clinicData.productItems.map((item) => {
      let daysToActivation: number | null = null;

      if (
        item.status === 'ACTIVATED' &&
        item.activations.length > 0 &&
        item.outboundLines.length > 0 &&
        item.outboundLines[0].outbound.shippedAt
      ) {
        const shippedAt = new Date(item.outboundLines[0].outbound.shippedAt);
        const activatedAt = new Date(item.activations[0].createdAt);
        const diffMs = activatedAt.getTime() - shippedAt.getTime();
        daysToActivation = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
      }

      return {
        id: item.id,
        serial12: item.serial12,
        sku: item.sku,
        name: item.name,
        status: item.status,
        activationCount: item.activationCount,
        activationType: item.productMaster?.activationType || 'SINGLE',
        maxActivations: item.productMaster?.maxActivations || 1,
        shippedDate: item.outboundLines[0]?.outbound.shippedAt || null,
        activatedDate:
          item.activations.length > 0 ? item.activations[0].createdAt : null,
        daysToActivation,
        activations: item.activations,
      };
    });

    return successResponse({
      clinic: clinicData.clinic,
      stats: clinicData.stats,
      products: productsWithDays,
      demographics,
    });
  } catch (error) {
    console.error('Clinic detail error:', error);
    return errors.internalError();
  }
}

export const GET = withManager(handleGET);
