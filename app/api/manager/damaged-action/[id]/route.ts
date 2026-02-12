import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// PATCH /api/manager/damaged-action/[id] - Approve or reject damaged action request
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  try {
    const { id } = await context.params
    const requestId = parseInt(id)
    const body = await request.json()
    const user = context.user

    if (isNaN(requestId)) {
      return errorResponse('Invalid request ID')
    }

    const actionRequest = await prisma.damagedActionRequest.findUnique({
      where: { id: requestId },
      include: { productItem: true },
    })

    if (!actionRequest) {
      return errors.notFound('Damaged action request')
    }

    if (actionRequest.status !== 'PENDING') {
      return errorResponse('Request is not pending')
    }

    if (body.action === 'approve') {
      await prisma.$transaction(async (tx) => {
        // 1. Update request status
        await tx.damagedActionRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            approvedById: user.userId,
            approvedAt: new Date(),
          },
        })

        // 2. Execute the actual action on the product
        const newStatus = actionRequest.actionType === 'RESTORE' ? 'IN_STOCK' : 'SCRAPPED'
        await tx.productItem.update({
          where: { id: actionRequest.productItemId },
          data: {
            status: newStatus,
            ...(newStatus === 'IN_STOCK' ? { assignedClinicId: null } : {}),
          },
        })

        // 3. Log the event
        await tx.eventLog.create({
          data: {
            eventType: actionRequest.actionType === 'RESTORE' ? 'REPAIR' : 'SCRAP',
            productItemId: actionRequest.productItemId,
            userId: user.userId,
            details: {
              action: actionRequest.actionType.toLowerCase(),
              repairNote: actionRequest.repairNote,
              approvedBy: user.userId,
              requestId,
            },
          },
        })
      })

      return successResponse({ message: 'Request approved' })
    }

    if (body.action === 'reject') {
      if (!body.rejectReason) {
        return errorResponse('Reject reason is required')
      }

      await prisma.$transaction(async (tx) => {
        await tx.damagedActionRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            approvedById: user.userId,
            approvedAt: new Date(),
            rejectReason: body.rejectReason,
          },
        })

        await tx.eventLog.create({
          data: {
            eventType: 'REJECT_DAMAGED_ACTION',
            productItemId: actionRequest.productItemId,
            userId: user.userId,
            details: {
              action: 'reject',
              reason: body.rejectReason,
              requestId,
            },
          },
        })
      })

      return successResponse({ message: 'Request rejected' })
    }

    return errorResponse('Invalid action')
  } catch (error) {
    console.error('Damaged action approval error:', error)
    return errors.internalError()
  }
}

export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER'], handlePATCH)
