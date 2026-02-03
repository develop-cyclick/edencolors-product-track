import { NextRequest } from 'next/server';
import { withManager } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import type { JWTPayload } from '@/lib/auth';
import { getDemographicStats } from '@/lib/analytics-queries';
import prisma from '@/lib/prisma';

type HandlerContext = { user: JWTPayload };

// GET /api/analytics/activations - Get activation timeline with demographics
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const clinicId = searchParams.get('clinicId');
    const province = searchParams.get('province');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      activationNumber: 1, // Only first activations
    };

    // Search filter
    if (search) {
      where.OR = [
        {
          productItem: {
            serial12: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          customerName: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Clinic filter
    if (clinicId) {
      const clinicIdNum = parseInt(clinicId);
      if (!isNaN(clinicIdNum)) {
        where.productItem = {
          ...where.productItem,
          assignedClinicId: clinicIdNum,
        };
      }
    }

    // Province filter
    if (province) {
      where.province = province;
    }

    // Date range filter
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Fetch activations
    const [activations, total] = await Promise.all([
      prisma.activation.findMany({
        where,
        include: {
          productItem: {
            select: {
              id: true,
              serial12: true,
              name: true,
              sku: true,
              assignedClinic: {
                select: {
                  id: true,
                  name: true,
                  province: true,
                },
              },
              outboundLines: {
                select: {
                  outbound: {
                    select: {
                      shippedAt: true,
                    },
                  },
                },
                where: {
                  outbound: {
                    status: 'APPROVED',
                  },
                },
                take: 1,
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.activation.count({ where }),
    ]);

    // Calculate days to activation for each
    const activationsWithDays = activations.map((activation) => {
      let daysToActivation: number | null = null;

      if (
        activation.productItem.outboundLines.length > 0 &&
        activation.productItem.outboundLines[0].outbound.shippedAt
      ) {
        const shippedAt = new Date(
          activation.productItem.outboundLines[0].outbound.shippedAt
        );
        const activatedAt = new Date(activation.createdAt);
        const diffMs = activatedAt.getTime() - shippedAt.getTime();
        daysToActivation = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
      }

      return {
        id: activation.id,
        serial12: activation.productItem.serial12,
        productName: activation.productItem.name,
        sku: activation.productItem.sku,
        clinicName: activation.productItem.assignedClinic?.name || 'Unknown',
        clinicProvince: activation.productItem.assignedClinic?.province || 'Unknown',
        customerName: activation.customerName,
        age: activation.age,
        gender: activation.gender,
        province: activation.province,
        createdAt: activation.createdAt,
        daysToActivation,
      };
    });

    // Get demographic stats
    const demographics = await getDemographicStats();

    // Get unique clinics and provinces for filters
    const [clinics, provinces] = await Promise.all([
      prisma.clinic.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          province: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.activation.findMany({
        where: {
          province: { not: null },
          activationNumber: 1,
        },
        select: { province: true },
        distinct: ['province'],
        orderBy: { province: 'asc' },
      }),
    ]);

    const uniqueProvinces = provinces
      .map((p) => p.province)
      .filter((p): p is string => p !== null);

    return successResponse({
      activations: activationsWithDays,
      demographics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        clinics,
        provinces: uniqueProvinces,
      },
    });
  } catch (error) {
    console.error('Activation timeline error:', error);
    return errors.internalError();
  }
}

export const GET = withManager(handleGET);
