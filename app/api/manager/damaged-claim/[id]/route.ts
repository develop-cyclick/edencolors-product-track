import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push-notification'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// PATCH /api/manager/damaged-claim/[id] - Approve or reject damaged claim
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) return errorResponse('Missing params')

  try {
    const { id } = await context.params
    const claimId = parseInt(id)
    const body = await request.json()
    const user = context.user

    if (isNaN(claimId)) return errorResponse('Invalid claim ID')

    const claim = await prisma.damagedClaim.findUnique({ where: { id: claimId } })
    if (!claim) return errors.notFound('Damaged claim')
    if (claim.status !== 'PENDING') return errorResponse('Claim is not pending')

    if (body.action === 'approve') {
      const updated = await prisma.damagedClaim.update({
        where: { id: claimId },
        data: {
          status: 'APPROVED',
          approvedById: user.userId,
          approvedAt: new Date(),
        },
        include: {
          clinic: { select: { name: true } },
          productMaster: { select: { sku: true, nameTh: true } },
        },
      })

      // Notify the creator
      sendPushToUser(claim.createdById, {
        title: 'คำร้องเคลมได้รับอนุมัติ',
        body: `คำร้อง ${claim.claimNumber} ได้รับอนุมัติแล้ว`,
        url: '/th/dashboard/damaged-products',
        tag: `claim-${claimId}`,
      }).catch(() => {})

      return successResponse({ claim: updated, message: 'Claim approved' })
    }

    if (body.action === 'reject') {
      if (!body.rejectReason) return errorResponse('Reject reason is required')

      const updated = await prisma.damagedClaim.update({
        where: { id: claimId },
        data: {
          status: 'REJECTED',
          approvedById: user.userId,
          approvedAt: new Date(),
          rejectReason: body.rejectReason,
        },
      })

      // Notify the creator
      sendPushToUser(claim.createdById, {
        title: 'คำร้องเคลมถูกปฏิเสธ',
        body: `คำร้อง ${claim.claimNumber} ถูกปฏิเสธ: ${body.rejectReason}`,
        url: '/th/dashboard/damaged-products',
        tag: `claim-${claimId}`,
      }).catch(() => {})

      return successResponse({ claim: updated, message: 'Claim rejected' })
    }

    return errorResponse('Invalid action')
  } catch (error) {
    console.error('Damaged claim approval error:', error)
    return errors.internalError()
  }
}

export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER'], handlePATCH)
