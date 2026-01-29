import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { ProductStatus, Prisma } from '@prisma/client'

type HandlerContext = { user: JWTPayload }

// GET /api/warehouse/damaged - List damaged products
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || '' // Filter by specific status (DAMAGED or RETURNED)

    const skip = (page - 1) * limit

    // Determine which statuses to filter by
    let statusFilter: ProductStatus[]
    if (status === 'DAMAGED') {
      statusFilter = [ProductStatus.DAMAGED]
    } else if (status === 'RETURNED') {
      statusFilter = [ProductStatus.RETURNED]
    } else {
      statusFilter = [ProductStatus.DAMAGED, ProductStatus.RETURNED]
    }

    const where: Prisma.ProductItemWhereInput = {
      status: { in: statusFilter },
      ...(search && {
        OR: [
          { serial12: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { productMaster: { sku: { contains: search, mode: 'insensitive' } } },
          { productMaster: { nameTh: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    }

    const [items, total] = await Promise.all([
      prisma.productItem.findMany({
        where,
        include: {
          productMaster: {
            select: {
              id: true,
              sku: true,
              nameTh: true,
              nameEn: true,
              modelSize: true,
              category: { select: { nameTh: true, nameEn: true } },
            },
          },
          assignedClinic: { select: { id: true, name: true } },
          grnLine: {
            select: {
              grnHeader: {
                select: {
                  warehouse: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productItem.count({ where }),
    ])

    // Get damage/return notes from event logs
    const itemsWithNotes = await Promise.all(
      items.map(async (item) => {
        // Look for DAMAGE event for DAMAGED items, RETURN event for RETURNED items
        const eventType = item.status === 'DAMAGED' ? 'DAMAGE' : 'RETURN'
        const eventLog = await prisma.eventLog.findFirst({
          where: {
            productItemId: item.id,
            eventType: eventType,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { displayName: true } },
          },
        })

        const details = eventLog?.details as { reason?: string; note?: string; notes?: string } | null
        return {
          ...item,
          warehouse: item.grnLine?.grnHeader?.warehouse || null,
          damageNote: details ? {
            reason: details.reason,
            note: details.note || details.notes, // DAMAGE uses 'note', RETURN uses 'notes'
          } : null,
          damagedAt: eventLog?.createdAt,
          damagedBy: eventLog?.user?.displayName,
        }
      })
    )

    return successResponse({
      items: itemsWithNotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List damaged products error:', error instanceof Error ? error.message : error)
    console.error('Full error:', error)
    return errors.internalError()
  }
}

// POST /api/warehouse/damaged - Mark product(s) as damaged
async function handlePOST(request: NextRequest, context: HandlerContext) {
  try {
    const body = await request.json()
    const user = context.user

    const { productItemIds, reason, note } = body as {
      productItemIds: number[]
      reason: string
      note?: string
    }

    if (!productItemIds || productItemIds.length === 0) {
      return errorResponse('At least one product item is required')
    }

    if (!reason) {
      return errorResponse('Damage reason is required')
    }

    // Verify all products exist and are in valid status
    const items = await prisma.productItem.findMany({
      where: { id: { in: productItemIds } },
    })

    if (items.length !== productItemIds.length) {
      return errorResponse('Some products not found')
    }

    // Only allow marking as damaged if in certain statuses
    const invalidItems = items.filter(
      (item) => !['IN_STOCK', 'SHIPPED', 'RETURNED'].includes(item.status)
    )

    if (invalidItems.length > 0) {
      return errorResponse(
        `Cannot mark as damaged: ${invalidItems.map((i) => i.serial12).join(', ')}`
      )
    }

    // Update status and log events
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.productItem.update({
          where: { id: item.id },
          data: { status: ProductStatus.DAMAGED },
        })

        await tx.eventLog.create({
          data: {
            eventType: 'DAMAGE',
            productItemId: item.id,
            userId: user.userId,
            details: {
              reason,
              note,
              previousStatus: item.status,
            },
          },
        })
      }
    })

    return successResponse({
      message: `${productItemIds.length} product(s) marked as damaged`,
      count: productItemIds.length,
    })
  } catch (error) {
    console.error('Mark products as damaged error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
export const POST = withWarehouse(handlePOST)
