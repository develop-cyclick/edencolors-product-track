import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { ProductStatus } from '@prisma/client'

type HandlerContext = { user: JWTPayload }

// GET /api/warehouse/products/available - Get available products for replacement
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')
    const excludeId = searchParams.get('excludeId')

    if (!sku) {
      return errors.badRequest('SKU is required')
    }

    // Find products with same SKU that are IN_STOCK
    const items = await prisma.productItem.findMany({
      where: {
        sku: sku,
        status: ProductStatus.IN_STOCK,
        ...(excludeId && { id: { not: parseInt(excludeId) } }),
      },
      select: {
        id: true,
        serial12: true,
        sku: true,
        name: true,
        modelSize: true,
        lot: true,
        expDate: true,
      },
      orderBy: [
        { expDate: 'asc' }, // Prioritize items with earlier expiry
        { createdAt: 'asc' }, // Then older items first (FIFO)
      ],
      take: 50, // Limit results
    })

    return successResponse({ items })
  } catch (error) {
    console.error('Get available products error:', error instanceof Error ? error.message : error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
