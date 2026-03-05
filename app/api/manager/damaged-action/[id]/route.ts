import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push-notification'

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
      include: { productItem: true, replacementItem: true },
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

        // 2.5 If scrapping, revoke all active QR tokens for this item
        if (newStatus === 'SCRAPPED') {
          await tx.qRToken.updateMany({
            where: {
              productItemId: actionRequest.productItemId,
              status: 'ACTIVE',
            },
            data: {
              status: 'REVOKED',
              revokedAt: new Date(),
              revokeReason: 'Product scrapped',
            },
          })

          // 2.6 If replacement item is provided, swap it in place of the old item
          if (actionRequest.replacementItemId && actionRequest.replacementItem) {
            const oldItem = actionRequest.productItem
            // The status before it was marked damaged (SHIPPED, ACTIVATED, etc.)
            // We use the status it had before being damaged - stored as the status
            // at the time of scrap. Since it's currently DAMAGED/RETURNED,
            // we check outbound lines to determine the correct status.
            const outboundLine = await tx.outboundLine.findFirst({
              where: { productItemId: oldItem.id },
              include: { outbound: { select: { status: true } } },
            })

            // Determine the correct status for replacement:
            // If it had an approved outbound → SHIPPED
            // If it had an activation → ACTIVATED
            // Otherwise → IN_STOCK
            let replacementStatus: ProductStatus = 'IN_STOCK'
            if (outboundLine && outboundLine.outbound.status === 'APPROVED') {
              replacementStatus = 'SHIPPED'
            }

            const activation = await tx.activation.findFirst({
              where: { productItemId: oldItem.id },
            })
            if (activation) {
              replacementStatus = 'ACTIVATED'
            }

            // Update replacement item with all data from old item
            await tx.productItem.update({
              where: { id: actionRequest.replacementItemId },
              data: {
                status: replacementStatus,
                lot: oldItem.lot,
                mfgDate: oldItem.mfgDate,
                expDate: oldItem.expDate,
                assignedClinicId: oldItem.assignedClinicId,
              },
            })

            // Move outbound lines from old item to replacement
            await tx.outboundLine.updateMany({
              where: { productItemId: oldItem.id },
              data: { productItemId: actionRequest.replacementItemId },
            })

            // Move activations from old item to replacement
            await tx.activation.updateMany({
              where: { productItemId: oldItem.id },
              data: { productItemId: actionRequest.replacementItemId },
            })

            // Move borrow transaction lines from old item to replacement
            await tx.borrowTransactionLine.updateMany({
              where: { productItemId: oldItem.id },
              data: { productItemId: actionRequest.replacementItemId },
            })

            await tx.eventLog.create({
              data: {
                eventType: 'PRE_GEN_REPLACE',
                productItemId: actionRequest.replacementItemId,
                userId: user.userId,
                details: {
                  replacedItemId: actionRequest.productItemId,
                  replacedSerial: oldItem.serial12,
                  replacementSerial: actionRequest.replacementItem.serial12,
                  previousStatus: replacementStatus,
                  reason: 'Replacement for scrapped item',
                  requestId,
                },
              },
            })
          }
        }

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
              replacementItemId: actionRequest.replacementItemId,
              requestId,
            },
          },
        })
      })

      // Notify the creator
      sendPushToUser(actionRequest.createdById, {
        title: actionRequest.actionType === 'SCRAP' ? 'คำขอทิ้งสินค้าอนุมัติแล้ว' : 'คำขอคืนเข้าคลังอนุมัติแล้ว',
        body: `คำขอสำหรับ ${actionRequest.productItem.serial12} ได้รับอนุมัติ`,
        url: '/th/dashboard/damaged-products',
        tag: `damaged-action-${requestId}`,
      }).catch(() => {})

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

      // Notify the creator
      sendPushToUser(actionRequest.createdById, {
        title: actionRequest.actionType === 'SCRAP' ? 'คำขอทิ้งสินค้าถูกปฏิเสธ' : 'คำขอคืนเข้าคลังถูกปฏิเสธ',
        body: `คำขอสำหรับ ${actionRequest.productItem.serial12} ถูกปฏิเสธ: ${body.rejectReason}`,
        url: '/th/dashboard/damaged-products',
        tag: `damaged-action-${requestId}`,
      }).catch(() => {})

      return successResponse({ message: 'Request rejected' })
    }

    return errorResponse('Invalid action')
  } catch (error) {
    console.error('Damaged action approval error:', error)
    return errors.internalError()
  }
}

export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER'], handlePATCH)
