import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/warehouse/return
// Process product return - changes status to RETURNED
// Supports both single product return and bulk lot return
async function handlePOST(request: NextRequest, context: HandlerContext) {
  const body = await request.json()
  const { productItemId, productItemIds, lot, reason, notes } = body as {
    productItemId?: number
    productItemIds?: number[]
    lot?: string
    reason: string
    notes?: string
  }
  const user = context.user

  if (!reason) {
    return errorResponse('Return reason is required')
  }

  // Determine which products to return
  let itemsToReturn: number[] = []

  if (productItemId) {
    // Single product return (legacy support)
    itemsToReturn = [productItemId]
  } else if (productItemIds && productItemIds.length > 0) {
    // Multiple products by IDs
    itemsToReturn = productItemIds
  } else if (lot) {
    // Return all returnable products in a lot
    const lotProducts = await prisma.productItem.findMany({
      where: {
        lot,
        status: { in: ['SHIPPED', 'ACTIVATED'] },
      },
      select: { id: true },
    })
    itemsToReturn = lotProducts.map((p) => p.id)
  }

  if (itemsToReturn.length === 0) {
    return errorResponse('No products specified for return')
  }

  // Find all product items
  const productItems = await prisma.productItem.findMany({
    where: { id: { in: itemsToReturn } },
    include: {
      category: true,
      assignedClinic: true,
      activation: true,
    },
  })

  if (productItems.length === 0) {
    return errorResponse('No products found', 404)
  }

  // Filter only returnable products
  const returnableItems = productItems.filter((p) =>
    ['SHIPPED', 'ACTIVATED'].includes(p.status)
  )

  if (returnableItems.length === 0) {
    return errorResponse('No products available for return (must be SHIPPED or ACTIVATED)')
  }

  const now = new Date()

  try {
    // Transaction: update status and log events for all items
    const results = await prisma.$transaction(async (tx) => {
      const updated = []

      for (const productItem of returnableItems) {
        // Update product status
        const result = await tx.productItem.update({
          where: { id: productItem.id },
          data: { status: 'RETURNED' },
        })

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'RETURN',
            productItemId: productItem.id,
            userId: user.userId,
            details: {
              previousStatus: productItem.status,
              wasActivated: !!productItem.activation,
              clinicId: productItem.assignedClinicId,
              clinicName: productItem.assignedClinic?.name,
              lot: productItem.lot || null,
              reason,
              notes: notes || null,
              returnedAt: now.toISOString(),
              bulkReturn: returnableItems.length > 1,
            },
          },
        })

        updated.push({
          productItemId: result.id,
          serial12: result.serial12,
          previousStatus: productItem.status,
          newStatus: result.status,
          wasActivated: !!productItem.activation,
        })
      }

      return updated
    })

    const skippedCount = productItems.length - returnableItems.length

    return successResponse({
      returnedCount: results.length,
      skippedCount,
      items: results,
      message: results.length === 1
        ? 'Product returned successfully'
        : `${results.length} products returned successfully${skippedCount > 0 ? ` (${skippedCount} skipped - not returnable)` : ''}`,
    })
  } catch (error) {
    console.error('Return error:', error)
    return errorResponse('Failed to process return', 500)
  }
}

// GET /api/warehouse/return
// Get returned products list
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = new URL(request.url)
  const serial = searchParams.get('serial')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {
    status: 'RETURNED',
  }

  if (serial) {
    where.serial12 = { contains: serial }
  }

  const [products, total] = await Promise.all([
    prisma.productItem.findMany({
      where,
      include: {
        category: { select: { id: true, nameTh: true } },
        assignedClinic: { select: { id: true, name: true, province: true } },
        activation: {
          select: {
            customerName: true,
            createdAt: true,
          },
        },
        eventLogs: {
          where: { eventType: 'RETURN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: { select: { displayName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productItem.count({ where }),
  ])

  return successResponse({
    items: products.map((p) => {
      const returnEvent = p.eventLogs[0]
      const details = returnEvent?.details as Record<string, unknown> | null

      return {
        id: p.id,
        serial12: p.serial12,
        name: p.name,
        category: p.category.nameTh,
        clinic: p.assignedClinic,
        wasActivated: !!p.activation,
        activatedBy: p.activation?.customerName,
        activatedAt: p.activation?.createdAt,
        returnedBy: returnEvent?.user?.displayName,
        returnedAt: returnEvent?.createdAt,
        returnReason: details?.reason as string | undefined,
        returnNotes: details?.notes as string | undefined,
      }
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export const POST = withWarehouse(handlePOST)
export const GET = withWarehouse(handleGET)
