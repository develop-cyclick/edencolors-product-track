import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/outbound/[id] - Get Outbound detail
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  const { id } = await context.params
  const outboundId = parseInt(id)

  if (isNaN(outboundId)) {
    return errorResponse('Invalid Outbound ID')
  }

  const outbound = await prisma.outboundHeader.findUnique({
    where: { id: outboundId },
    include: {
      warehouse: { select: { id: true, name: true } },
      shippingMethod: { select: { id: true, nameTh: true, nameEn: true } },
      clinic: { select: { id: true, name: true, province: true, branchName: true } },
      createdBy: { select: { id: true, displayName: true, username: true } },
      approvedBy: { select: { id: true, displayName: true, username: true } },
      purchaseOrder: { select: { id: true, poNo: true, status: true } },
      lines: {
        include: {
          productItem: {
            include: {
              category: { select: { id: true, nameTh: true, nameEn: true } },
              qrTokens: {
                where: { status: 'ACTIVE' },
                select: { id: true, tokenVersion: true },
              },
            },
          },
          unit: { select: { id: true, nameTh: true, nameEn: true } },
        },
      },
    },
  })

  if (!outbound) {
    return errors.notFound('Outbound')
  }

  return successResponse({ outbound })
}

// PATCH /api/warehouse/outbound/[id] - Update/Approve/Reject Outbound
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  const { id } = await context.params
  const outboundId = parseInt(id)
  const body = await request.json()
  const user = context.user

  if (isNaN(outboundId)) {
    return errorResponse('Invalid Outbound ID')
  }

  const outbound = await prisma.outboundHeader.findUnique({
    where: { id: outboundId },
    include: {
      lines: {
        include: {
          productItem: true,
        },
      },
    },
  })

  if (!outbound) {
    return errors.notFound('Outbound')
  }

  // Handle approval
  if (body.action === 'approve') {
    // Only manager/admin can approve
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return errors.forbidden()
    }

    if (outbound.status !== 'PENDING') {
      return errorResponse('Can only approve PENDING outbounds')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update outbound status
      const updated = await tx.outboundHeader.update({
        where: { id: outboundId },
        data: {
          status: 'APPROVED',
          approvedById: user.userId,
          approvedAt: new Date(),
          shippedAt: new Date(),
        },
      })

      // Update all product items to SHIPPED
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: { status: 'SHIPPED' },
        })

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'APPROVE',
            productItemId: line.productItemId,
            userId: user.userId,
            details: {
              deliveryNoteNo: outbound.deliveryNoteNo,
              action: 'approve',
            },
          },
        })
      }

      // Update PurchaseOrder shipped quantities if linked to a PO
      if (outbound.purchaseOrderId) {
        // Count how many of each ProductMaster we're shipping
        const shippedByProductMaster: Record<number, number> = {}
        for (const line of outbound.lines) {
          const pmId = line.productItem?.productMasterId
          if (pmId && pmId > 0) {
            shippedByProductMaster[pmId] = (shippedByProductMaster[pmId] || 0) + 1
          }
        }

        // Get PO lines and update shippedQuantity
        const poLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: outbound.purchaseOrderId },
        })

        for (const poLine of poLines) {
          const shipped = shippedByProductMaster[poLine.productMasterId] || 0
          if (shipped > 0) {
            await tx.purchaseOrderLine.update({
              where: { id: poLine.id },
              data: {
                shippedQuantity: { increment: shipped },
              },
            })
            // Deduct from what we're tracking so we don't double-count
            shippedByProductMaster[poLine.productMasterId] -= shipped
          }
        }

        // Check if PO is fully shipped and update status
        const updatedPOLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: outbound.purchaseOrderId },
        })

        const allShipped = updatedPOLines.every((line) => line.shippedQuantity >= line.quantity)
        const someShipped = updatedPOLines.some((line) => line.shippedQuantity > 0)

        let newStatus: 'CONFIRMED' | 'PARTIAL' | 'COMPLETED' = 'CONFIRMED'
        if (allShipped) {
          newStatus = 'COMPLETED'
        } else if (someShipped) {
          newStatus = 'PARTIAL'
        }

        await tx.purchaseOrder.update({
          where: { id: outbound.purchaseOrderId },
          data: { status: newStatus },
        })
      }

      return updated
    })

    return successResponse(result)
  }

  // Handle rejection
  if (body.action === 'reject') {
    // Only manager/admin can reject
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return errors.forbidden()
    }

    if (outbound.status !== 'PENDING') {
      return errorResponse('Can only reject PENDING outbounds')
    }

    if (!body.rejectReason) {
      return errorResponse('Reject reason is required')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update outbound status
      const updated = await tx.outboundHeader.update({
        where: { id: outboundId },
        data: {
          status: 'REJECTED',
          approvedById: user.userId,
          approvedAt: new Date(),
          rejectReason: body.rejectReason,
        },
      })

      // Revert all product items to IN_STOCK and remove clinic assignment
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'REJECT',
            productItemId: line.productItemId,
            userId: user.userId,
            details: {
              deliveryNoteNo: outbound.deliveryNoteNo,
              action: 'reject',
              reason: body.rejectReason,
            },
          },
        })
      }

      return updated
    })

    return successResponse(result)
  }

  // Handle cancel (by warehouse user, only DRAFT or PENDING)
  if (body.action === 'cancel') {
    if (!['DRAFT', 'PENDING'].includes(outbound.status)) {
      return errorResponse('Can only cancel DRAFT or PENDING outbounds')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Revert all product items to IN_STOCK
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })
      }

      // Delete outbound lines
      await tx.outboundLine.deleteMany({
        where: { outboundId: outboundId },
      })

      // Delete outbound header
      await tx.outboundHeader.delete({
        where: { id: outboundId },
      })

      return { cancelled: true }
    })

    return successResponse(result)
  }

  // Update header fields (only for DRAFT status)
  if (outbound.status !== 'DRAFT') {
    return errorResponse('Can only update DRAFT outbounds')
  }

  const allowedFields = [
    'shippingMethodId',
    'deliveryNoteNo',
    'contractNo',
    'salesPersonName',
    'companyContact',
    'clinicAddress',
    'clinicPhone',
    'clinicEmail',
    'clinicContactName',
    'poNo',
    'remarks',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  // Handle submit for approval
  if (body.submit) {
    updateData.status = 'PENDING'
  }

  const updated = await prisma.outboundHeader.update({
    where: { id: outboundId },
    data: updateData,
    include: {
      warehouse: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  })

  return successResponse(updated)
}

// PUT /api/warehouse/outbound/[id] - Full edit of Outbound (only PENDING status)
async function handlePUT(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  const { id } = await context.params
  const outboundId = parseInt(id)
  const body = await request.json()
  const user = context.user

  if (isNaN(outboundId)) {
    return errorResponse('Invalid Outbound ID')
  }

  const outbound = await prisma.outboundHeader.findUnique({
    where: { id: outboundId },
    include: {
      lines: {
        include: {
          productItem: true,
        },
      },
    },
  })

  if (!outbound) {
    return errors.notFound('Outbound')
  }

  // Only allow editing PENDING outbounds
  if (outbound.status !== 'PENDING') {
    return errorResponse('Can only edit PENDING outbounds')
  }

  // Validate required fields
  if (!body.clinicId) {
    return errorResponse('Clinic is required')
  }

  if (!body.linesByProductMaster || body.linesByProductMaster.length === 0) {
    return errorResponse('At least one product line is required')
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert all current product items to IN_STOCK
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })
      }

      // 2. Delete all current lines
      await tx.outboundLine.deleteMany({
        where: { outboundId: outboundId },
      })

      // 3. Get default unit
      const defaultUnit = await tx.unit.findFirst({ where: { nameTh: 'ชิ้น' } })
      if (!defaultUnit) {
        throw new Error('Default unit not found')
      }

      // 4. Create new lines with FIFO selection
      const newLines = []
      for (const lineReq of body.linesByProductMaster) {
        const { productMasterId, quantity } = lineReq

        // Get product master info
        const productMaster = await tx.productMaster.findUnique({
          where: { id: productMasterId },
          include: { defaultUnit: true },
        })

        if (!productMaster) {
          throw new Error(`Product master ${productMasterId} not found`)
        }

        // FIFO selection - get IN_STOCK items ordered by expDate (nearest first), then createdAt
        const availableItems = await tx.productItem.findMany({
          where: {
            productMasterId: productMasterId,
            status: 'IN_STOCK',
          },
          orderBy: [
            { expDate: 'asc' },
            { createdAt: 'asc' },
          ],
          take: quantity,
        })

        if (availableItems.length < quantity) {
          throw new Error(`Insufficient stock for ${productMaster.sku}: need ${quantity}, have ${availableItems.length}`)
        }

        // Create outbound lines and update product item status
        for (const item of availableItems) {
          const lineUnit = productMaster.defaultUnit || defaultUnit

          const newLine = await tx.outboundLine.create({
            data: {
              outboundId: outboundId,
              productItemId: item.id,
              quantity: 1,
              unitId: lineUnit.id,
            },
          })

          // Update product item status to PENDING_OUT and assign clinic
          await tx.productItem.update({
            where: { id: item.id },
            data: {
              status: 'PENDING_OUT',
              assignedClinicId: body.clinicId,
            },
          })

          newLines.push(newLine)
        }
      }

      // 5. Update header fields
      const updated = await tx.outboundHeader.update({
        where: { id: outboundId },
        data: {
          warehouseId: body.warehouseId || outbound.warehouseId,
          shippingMethodId: body.shippingMethodId || outbound.shippingMethodId,
          clinicId: body.clinicId,
          deliveryNoteNo: body.deliveryNoteNo,
          contractNo: body.contractNo,
          salesPersonName: body.salesPersonName,
          companyContact: body.companyContact,
          clinicAddress: body.clinicAddress,
          clinicPhone: body.clinicPhone,
          clinicEmail: body.clinicEmail,
          clinicContactName: body.clinicContactName,
          purchaseOrderId: body.purchaseOrderId,
          remarks: body.remarks,
        },
        include: {
          warehouse: { select: { id: true, name: true } },
          clinic: { select: { id: true, name: true } },
          lines: true,
        },
      })

      return {
        ...updated,
        linesCreated: newLines.length,
      }
    })

    return successResponse(result)
  } catch (error) {
    console.error('Update outbound error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to update outbound')
  }
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePATCH)
export const PUT = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePUT)
