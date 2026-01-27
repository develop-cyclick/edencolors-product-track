import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/grn/[id] - Get GRN detail
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  const { id } = await context.params
  const grnId = parseInt(id)

  if (isNaN(grnId)) {
    return errorResponse('Invalid GRN ID', 400)
  }

  const grn = await prisma.gRNHeader.findUnique({
    where: { id: grnId },
    include: {
      warehouse: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, displayName: true, username: true } },
      approvedBy: { select: { id: true, displayName: true, username: true } },
      lines: {
        include: {
          productItem: {
            include: {
              category: { select: { id: true, nameTh: true, nameEn: true } },
              qrTokens: {
                where: { status: 'ACTIVE' },
                select: { id: true, tokenVersion: true, issuedAt: true },
              },
            },
          },
          unit: { select: { id: true, nameTh: true, nameEn: true } },
        },
      },
    },
  })

  if (!grn) {
    return errors.notFound('GRN')
  }

  return successResponse({ grn })
}

// PATCH /api/warehouse/grn/[id] - Update GRN (header only, before approval)
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  const { id } = await context.params
  const grnId = parseInt(id)
  const body = await request.json()
  const user = context.user

  if (isNaN(grnId)) {
    return errorResponse('Invalid GRN ID', 400)
  }

  // Use raw SQL to check status since Prisma client may not have new fields
  const grnResult = await prisma.$queryRaw<Array<{
    id: number
    approved_at: Date | null
    rejected_at: Date | null
  }>>`
    SELECT id, approved_at, rejected_at
    FROM grn_headers
    WHERE id = ${grnId}
  `

  if (grnResult.length === 0) {
    return errors.notFound('GRN')
  }

  const grn = grnResult[0]

  // Check if already approved or rejected
  if (grn.approved_at) {
    return errorResponse('Cannot modify approved GRN', 400)
  }

  if (grn.rejected_at) {
    return errorResponse('Cannot modify rejected GRN', 400)
  }

  // Handle approval
  if (body.action === 'approve') {
    // Only manager/admin can approve
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return errors.forbidden()
    }

    const updated = await prisma.gRNHeader.update({
      where: { id: grnId },
      data: {
        approvedById: user.userId,
        approvedAt: new Date(),
      },
    })

    return successResponse({ grn: updated })
  }

  // Handle rejection
  if (body.action === 'reject') {
    // Only manager/admin can reject
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return errors.forbidden()
    }

    if (!body.rejectReason) {
      return errorResponse('Reject reason is required', 400)
    }

    // Use raw SQL since Prisma client may not be regenerated yet
    await prisma.$executeRaw`
      UPDATE grn_headers
      SET rejected_by_id = ${user.userId},
          rejected_at = ${new Date()},
          reject_reason = ${body.rejectReason},
          updated_at = ${new Date()}
      WHERE id = ${grnId}
    `

    const updated = await prisma.gRNHeader.findUnique({
      where: { id: grnId },
    })

    return successResponse({ grn: updated })
  }

  // Update header fields
  const allowedFields = [
    'receivedAt',
    'poNo',
    'supplierName',
    'deliveryNoteNo',
    'supplierAddress',
    'supplierPhone',
    'supplierContact',
    'deliveryDocDate',
    'remarks',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'receivedAt' || field === 'deliveryDocDate') {
        updateData[field] = body[field] ? new Date(body[field]) : null
      } else {
        updateData[field] = body[field]
      }
    }
  }

  const updated = await prisma.gRNHeader.update({
    where: { id: grnId },
    data: updateData,
    include: {
      warehouse: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, displayName: true } },
    },
  })

  return successResponse({ grn: updated })
}

// DELETE /api/warehouse/grn/[id] - Delete GRN (only if not approved and no outbounds)
async function handleDELETE(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  const { id } = await context.params
  const grnId = parseInt(id)

  if (isNaN(grnId)) {
    return errorResponse('Invalid GRN ID', 400)
  }

  const grn = await prisma.gRNHeader.findUnique({
    where: { id: grnId },
    include: {
      lines: {
        include: {
          productItem: {
            include: {
              outboundLines: true,
            },
          },
        },
      },
    },
  })

  if (!grn) {
    return errors.notFound('GRN')
  }

  // Check if approved
  if (grn.approvedAt) {
    return errorResponse('Cannot delete approved GRN', 400)
  }

  // Check if any product has outbound
  const hasOutbound = grn.lines.some(
    (line) => line.productItem.outboundLines.length > 0
  )

  if (hasOutbound) {
    return errorResponse('Cannot delete GRN with products that have outbound records', 400)
  }

  // Delete in transaction (cascade)
  await prisma.$transaction(async (tx) => {
    // Get all product item IDs
    const productItemIds = grn.lines.map((line) => line.productItem.id)

    // Delete scan logs
    await tx.scanLog.deleteMany({
      where: { productItemId: { in: productItemIds } },
    })

    // Delete event logs
    await tx.eventLog.deleteMany({
      where: { productItemId: { in: productItemIds } },
    })

    // Delete QR tokens
    await tx.qRToken.deleteMany({
      where: { productItemId: { in: productItemIds } },
    })

    // Delete GRN lines
    await tx.gRNLine.deleteMany({
      where: { grnHeaderId: grnId },
    })

    // Delete product items
    await tx.productItem.deleteMany({
      where: { id: { in: productItemIds } },
    })

    // Delete GRN header
    await tx.gRNHeader.delete({
      where: { id: grnId },
    })
  })

  return successResponse({ deleted: true })
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePATCH)
export const DELETE = withRoles<RouteParams>(['ADMIN'], handleDELETE)
