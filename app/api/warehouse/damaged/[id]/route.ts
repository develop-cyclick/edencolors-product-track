import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// PATCH /api/warehouse/damaged/[id] - Restore damaged product
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  try {
    const { id } = await context.params
    const productItemId = parseInt(id)
    const body = await request.json()
    const user = context.user

    if (isNaN(productItemId)) {
      return errorResponse('Invalid product item ID')
    }

    const { action, repairNote } = body as {
      action: 'restore' | 'scrap'
      repairNote?: string
    }

    const item = await prisma.productItem.findUnique({
      where: { id: productItemId },
    })

    if (!item) {
      return errors.notFound('Product item')
    }

    if (item.status !== 'DAMAGED') {
      return errorResponse('Product is not in DAMAGED status')
    }

    if (action === 'restore') {
      // Restore to IN_STOCK
      await prisma.$transaction(async (tx) => {
        await tx.productItem.update({
          where: { id: productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })

        await tx.eventLog.create({
          data: {
            eventType: 'REPAIR',
            productItemId,
            userId: user.userId,
            details: {
              action: 'restore',
              repairNote,
            },
          },
        })
      })

      return successResponse({
        message: 'Product restored to stock',
        serial12: item.serial12,
      })
    } else if (action === 'scrap') {
      // Mark as scrapped (keep as DAMAGED but log it)
      await prisma.eventLog.create({
        data: {
          eventType: 'SCRAP',
          productItemId,
          userId: user.userId,
          details: {
            action: 'scrap',
            note: repairNote,
          },
        },
      })

      return successResponse({
        message: 'Product marked as scrapped',
        serial12: item.serial12,
      })
    }

    return errorResponse('Invalid action')
  } catch (error) {
    console.error('Restore damaged product error:', error)
    return errors.internalError()
  }
}

export const PATCH = withWarehouse(handlePATCH)
