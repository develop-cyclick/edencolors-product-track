import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// PATCH /api/warehouse/damaged/[id] - Submit restore/scrap request for approval
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

    const { action, repairNote, replacementItemId } = body as {
      action: 'restore' | 'scrap'
      repairNote?: string
      replacementItemId?: number
    }

    if (action !== 'restore' && action !== 'scrap') {
      return errorResponse('Invalid action')
    }

    const item = await prisma.productItem.findUnique({
      where: { id: productItemId },
    })

    if (!item) {
      return errors.notFound('Product item')
    }

    if (item.status !== 'DAMAGED' && item.status !== 'RETURNED') {
      return errorResponse('Product is not in DAMAGED or RETURNED status')
    }

    // Check no existing PENDING request for this item
    const existingRequest = await prisma.damagedActionRequest.findFirst({
      where: { productItemId, status: 'PENDING' },
    })

    if (existingRequest) {
      return errorResponse('This product already has a pending action request')
    }

    // Validate replacement item if provided (scrap with pre-gen QR replacement)
    if (replacementItemId && action === 'scrap') {
      const replacementItem = await prisma.productItem.findUnique({
        where: { id: replacementItemId },
      })
      if (!replacementItem) {
        return errorResponse('Replacement item not found')
      }
      if (replacementItem.status !== 'PENDING_LINK') {
        return errorResponse('Replacement item is not available (must be PENDING_LINK)')
      }
      if (replacementItem.productMasterId !== item.productMasterId) {
        return errorResponse('Replacement item must be the same product type')
      }
    }

    const actionRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.damagedActionRequest.create({
        data: {
          productItemId,
          actionType: action === 'restore' ? 'RESTORE' : 'SCRAP',
          repairNote: repairNote || null,
          replacementItemId: action === 'scrap' ? (replacementItemId || null) : null,
          createdById: user.userId,
        },
      })

      await tx.eventLog.create({
        data: {
          eventType: 'DAMAGED_ACTION_REQUEST',
          productItemId,
          userId: user.userId,
          details: {
            action,
            repairNote,
            replacementItemId: replacementItemId || null,
            requestId: request.id,
          },
        },
      })

      return request
    })

    return successResponse({
      message: action === 'restore'
        ? 'Restore request submitted for approval'
        : 'Scrap request submitted for approval',
      requestId: actionRequest.id,
      serial12: item.serial12,
    })
  } catch (error) {
    console.error('Damaged action request error:', error)
    return errors.internalError()
  }
}

export const PATCH = withWarehouse(handlePATCH)
