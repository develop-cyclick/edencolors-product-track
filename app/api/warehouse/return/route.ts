import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { BorrowStatus } from '@prisma/client'
import { generateBorrowNumber } from '@/lib/serial-generator'

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
      activations: true,
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

  // Create a PENDING approval request (BorrowTransaction, type PRODUCT_RETURN).
  // Items stay SHIPPED/ACTIVATED until a manager approves; approval sets them to RETURNED.
  const transactionNo = await generateBorrowNumber()
  const defaultUnit = await prisma.unit.findFirst({ where: { nameTh: 'ชิ้น' } })
  const defaultUnitId = defaultUnit?.id || 1
  const borrowerName =
    returnableItems.find((p) => p.assignedClinic?.name)?.assignedClinic?.name || 'รับคืนสินค้า'

  try {
    const txn = await prisma.$transaction(async (tx) => {
      const created = await tx.borrowTransaction.create({
        data: {
          transactionNo,
          type: 'PRODUCT_RETURN',
          status: BorrowStatus.PENDING,
          borrowerName,
          reason: reason?.trim() || null,
          remarks: notes?.trim() || null,
          createdById: user.userId,
        },
      })

      for (const productItem of returnableItems) {
        await tx.borrowTransactionLine.create({
          data: {
            borrowTransactionId: created.id,
            productItemId: productItem.id,
            sku: productItem.sku,
            itemName: productItem.name,
            modelSize: productItem.modelSize,
            quantity: 1,
            unitId: defaultUnitId,
            lot: productItem.lot,
            expDate: productItem.expDate,
          },
        })
      }

      return created
    })

    const skippedCount = productItems.length - returnableItems.length

    return successResponse({
      transactionNo: txn.transactionNo,
      returnedCount: returnableItems.length, // items included in the pending request (UI compat)
      skippedCount,
      message: `Return request created (pending approval): ${txn.transactionNo}${skippedCount > 0 ? ` (${skippedCount} skipped - not returnable)` : ''}`,
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
        assignedClinic: { select: { id: true, name: true, address: true } },
        activations: {
          select: {
            customerName: true,
            createdAt: true,
          },
          orderBy: { activationNumber: 'desc' as const },
          take: 1,
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
      // serial12 tiebreaker keeps ordering + pagination stable for same-batch items
      orderBy: [{ updatedAt: 'desc' }, { serial12: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.productItem.count({ where }),
  ])

  return successResponse({
    items: products.map((p) => {
      const returnEvent = p.eventLogs[0]
      const details = returnEvent?.details as Record<string, unknown> | null
      const latestActivation = p.activations[0]

      return {
        id: p.id,
        serial12: p.serial12,
        name: p.name,
        category: p.category.nameTh,
        clinic: p.assignedClinic,
        wasActivated: p.activations.length > 0,
        activatedBy: latestActivation?.customerName,
        activatedAt: latestActivation?.createdAt,
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
