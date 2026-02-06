import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/admin/purchase-orders/[id] - Get purchase order detail
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  try {
    const { id } = await context.params
    const purchaseOrderId = parseInt(id)

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            province: true,
            branchName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
        lines: {
          include: {
            productMaster: {
              select: {
                id: true,
                sku: true,
                nameTh: true,
                nameEn: true,
                modelSize: true,
                category: {
                  select: {
                    nameTh: true,
                    nameEn: true,
                  },
                },
              },
            },
          },
        },
        outbounds: {
          select: {
            id: true,
            deliveryNoteNo: true,
            status: true,
            createdAt: true,
            shippedAt: true,
            lines: {
              select: {
                id: true,
                sku: true,
                itemName: true,
                quantity: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!purchaseOrder) {
      return errors.notFound('Purchase order not found')
    }

    // Calculate summary
    const totalOrdered = purchaseOrder.lines.reduce((sum, line) => sum + line.quantity, 0)
    const totalShipped = purchaseOrder.lines.reduce((sum, line) => sum + line.shippedQuantity, 0)
    const totalRemaining = totalOrdered - totalShipped

    return successResponse({
      purchaseOrder: {
        ...purchaseOrder,
        summary: {
          totalOrdered,
          totalShipped,
          totalRemaining,
          lineCount: purchaseOrder.lines.length,
        },
      },
    })
  } catch (error) {
    console.error('Get purchase order error:', error)
    return errors.internalError()
  }
}

// PATCH /api/admin/purchase-orders/[id] - Update purchase order
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  try {
    const { id } = await context.params
    const purchaseOrderId = parseInt(id)
    const body = await request.json()

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    })

    if (!existing) {
      return errors.notFound('Purchase order not found')
    }

    // Don't allow editing if completed or cancelled
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return errorResponse('Cannot edit completed or cancelled purchase order', 400)
    }

    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData.status = body.status
    if (body.remarks !== undefined) updateData.remarks = body.remarks

    // Update lines if provided
    if (body.lines && Array.isArray(body.lines)) {
      // Delete existing lines and create new ones
      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId },
      })

      await prisma.purchaseOrderLine.createMany({
        data: body.lines.map((line: { productMasterId: number; quantity: number; shippedQuantity?: number }) => ({
          purchaseOrderId,
          productMasterId: line.productMasterId,
          quantity: line.quantity,
          shippedQuantity: line.shippedQuantity || 0,
        })),
      })
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: updateData,
      include: {
        clinic: true,
        lines: {
          include: {
            productMaster: true,
          },
        },
      },
    })

    return successResponse({ purchaseOrder })
  } catch (error) {
    console.error('Update purchase order error:', error)
    return errors.internalError()
  }
}

// PUT /api/admin/purchase-orders/[id] - Full edit of purchase order (CONFIRMED status only)
async function handlePUT(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  try {
    const { id } = await context.params
    const purchaseOrderId = parseInt(id)
    const body = await request.json()

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        lines: true,
      },
    })

    if (!existing) {
      return errors.notFound('Purchase order not found')
    }

    // Only allow editing CONFIRMED status
    if (existing.status !== 'CONFIRMED') {
      return errorResponse('Can only edit purchase orders with CONFIRMED status', 400)
    }

    // Validate required fields
    if (!body.clinicId) {
      return errorResponse('Clinic is required', 400)
    }

    if (!body.lines || body.lines.length === 0) {
      return errorResponse('At least one product line is required', 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      // Delete existing lines
      await tx.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId },
      })

      // Create new lines
      await tx.purchaseOrderLine.createMany({
        data: body.lines.map((line: { productMasterId: number; quantity: number }) => ({
          purchaseOrderId,
          productMasterId: line.productMasterId,
          quantity: line.quantity,
          shippedQuantity: 0, // Reset shipped quantity when editing
        })),
      })

      // Update header
      const updated = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          clinicId: body.clinicId,
          remarks: body.remarks || null,
          // Delivery info fields
          deliveryNoteNo: body.deliveryNoteNo || null,
          contractNo: body.contractNo || null,
          salesPersonName: body.salesPersonName || null,
          companyContact: body.companyContact || null,
          clinicAddress: body.clinicAddress || null,
          clinicPhone: body.clinicPhone || null,
          clinicEmail: body.clinicEmail || null,
          clinicContactName: body.clinicContactName || null,
        },
        include: {
          clinic: true,
          lines: {
            include: {
              productMaster: true,
            },
          },
        },
      })

      return updated
    })

    return successResponse({ purchaseOrder: result })
  } catch (error) {
    console.error('Update purchase order error:', error)
    return errors.internalError()
  }
}

// DELETE /api/admin/purchase-orders/[id] - Delete/Cancel purchase order
async function handleDELETE(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  try {
    const { id } = await context.params
    const purchaseOrderId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const hard = searchParams.get('hard') === 'true'

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        outbounds: true,
      },
    })

    if (!existing) {
      return errors.notFound('Purchase order not found')
    }

    // Check if has outbounds
    if (existing.outbounds.length > 0) {
      return errorResponse('Cannot delete purchase order with outbound records', 400)
    }

    if (hard) {
      // Hard delete
      await prisma.purchaseOrder.delete({
        where: { id: purchaseOrderId },
      })
      return successResponse({ message: 'Purchase order deleted successfully' })
    } else {
      // Soft delete - just cancel
      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: 'CANCELLED' },
      })
      return successResponse({ message: 'Purchase order cancelled successfully' })
    }
  } catch (error) {
    console.error('Delete purchase order error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse<RouteParams>(handleGET)
export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER'], handlePATCH)
export const PUT = withRoles<RouteParams>(['ADMIN', 'MANAGER'], handlePUT)
export const DELETE = withRoles<RouteParams>(['ADMIN', 'MANAGER'], handleDELETE)
