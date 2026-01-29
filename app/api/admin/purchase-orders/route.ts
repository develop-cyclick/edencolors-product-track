import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// GET /api/admin/purchase-orders - List all purchase orders
export const GET = withWarehouse(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    const status = searchParams.get('status')
    const hasRemaining = searchParams.get('hasRemaining') // filter POs that still have items to ship

    const where: Record<string, unknown> = {}

    if (clinicId) {
      where.clinicId = parseInt(clinicId)
    }

    if (status) {
      where.status = status
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
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
          },
        },
        _count: {
          select: {
            outbounds: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter POs with remaining items if requested
    let result = purchaseOrders
    if (hasRemaining === 'true') {
      result = purchaseOrders.filter((po) => {
        return po.lines.some((line) => line.quantity > line.shippedQuantity)
      })
    }

    // Calculate summary for each PO
    const purchaseOrdersWithSummary = result.map((po) => {
      const totalOrdered = po.lines.reduce((sum, line) => sum + line.quantity, 0)
      const totalShipped = po.lines.reduce((sum, line) => sum + line.shippedQuantity, 0)
      const totalRemaining = totalOrdered - totalShipped

      return {
        ...po,
        summary: {
          totalOrdered,
          totalShipped,
          totalRemaining,
          lineCount: po.lines.length,
        },
      }
    })

    return successResponse({ purchaseOrders: purchaseOrdersWithSummary })
  } catch (error) {
    console.error('List purchase orders error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/purchase-orders - Create a new purchase order
export const POST = withAdmin(async (request: NextRequest, context) => {
  try {
    const { user } = context
    const body = await request.json()

    // Validate required fields
    if (!body.clinicId) {
      return errorResponse('Clinic is required', 400)
    }

    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      return errorResponse('At least one line item is required', 400)
    }

    // Generate PO number
    const year = new Date().getFullYear()
    const prefix = `PO-${year}-`

    const counter = await prisma.sequenceCounter.upsert({
      where: { name: 'PO' },
      update: { currentVal: { increment: 1 } },
      create: { name: 'PO', prefix, currentVal: 1 },
    })

    const poNo = `${prefix}${String(counter.currentVal).padStart(6, '0')}`

    // Create PO with lines
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNo,
        clinicId: body.clinicId,
        status: body.status || 'CONFIRMED',
        remarks: body.remarks || null,
        createdById: user.userId,
        lines: {
          create: body.lines.map((line: { productMasterId: number; quantity: number }) => ({
            productMasterId: line.productMasterId,
            quantity: line.quantity,
            shippedQuantity: 0,
          })),
        },
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

    return successResponse({ purchaseOrder }, 201)
  } catch (error) {
    console.error('Create purchase order error:', error)
    return errors.internalError()
  }
})
