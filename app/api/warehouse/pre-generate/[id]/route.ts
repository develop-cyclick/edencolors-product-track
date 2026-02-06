import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload; params?: Promise<{ id: string }> }

// GET /api/warehouse/pre-generate/[id] - Get batch detail with all items
async function handleGET(request: NextRequest, context: HandlerContext) {
  const params = await context.params
  const id = parseInt(params?.id || '0')

  if (!id) {
    return errors.badRequest('Invalid batch ID')
  }

  const batch = await prisma.preGeneratedBatch.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, displayName: true } },
      productMaster: { select: { id: true, sku: true, nameTh: true, serialCode: true } },
      productItems: {
        include: {
          qrTokens: {
            where: { status: 'ACTIVE' },
            orderBy: { tokenVersion: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!batch) {
    return errors.notFound('Batch')
  }

  // Calculate stats
  const linkedCount = batch.productItems.filter(
    (item) => item.status !== 'PENDING_LINK'
  ).length
  const availableCount = batch.productItems.filter(
    (item) => item.status === 'PENDING_LINK'
  ).length

  return successResponse({
    id: batch.id,
    batchNo: batch.batchNo,
    quantity: batch.quantity,
    linkedCount,
    availableCount,
    productMaster: batch.productMaster,
    createdBy: batch.createdBy,
    remarks: batch.remarks,
    createdAt: batch.createdAt,
    items: batch.productItems.map((item) => ({
      id: item.id,
      serial12: item.serial12,
      status: item.status,
      isLinked: item.status !== 'PENDING_LINK',
      qrToken: item.qrTokens[0]?.token || null,
      createdAt: item.createdAt,
    })),
  })
}

// DELETE /api/warehouse/pre-generate/[id] - Cancel/delete batch (only unlinked items)
async function handleDELETE(request: NextRequest, context: HandlerContext) {
  const params = await context.params
  const id = parseInt(params?.id || '0')
  const user = context.user

  if (!id) {
    return errors.badRequest('Invalid batch ID')
  }

  const batch = await prisma.preGeneratedBatch.findUnique({
    where: { id },
    include: {
      productItems: true,
    },
  })

  if (!batch) {
    return errors.notFound('Batch')
  }

  // Check if any items are linked
  const linkedItems = batch.productItems.filter(
    (item) => item.status !== 'PENDING_LINK'
  )

  if (linkedItems.length > 0) {
    // Only delete unlinked items
    const unlinkedItemIds = batch.productItems
      .filter((item) => item.status === 'PENDING_LINK')
      .map((item) => item.id)

    if (unlinkedItemIds.length === 0) {
      return errors.badRequest('All items in this batch have been linked. Cannot delete.')
    }

    await prisma.$transaction(async (tx) => {
      // Delete QR tokens for unlinked items
      await tx.qRToken.deleteMany({
        where: { productItemId: { in: unlinkedItemIds } },
      })

      // Delete unlinked product items
      await tx.productItem.deleteMany({
        where: { id: { in: unlinkedItemIds } },
      })

      // Update batch quantity
      await tx.preGeneratedBatch.update({
        where: { id },
        data: {
          quantity: linkedItems.length,
        },
      })

      // Log event
      await tx.eventLog.create({
        data: {
          eventType: 'PRE_GEN_PARTIAL_DELETE',
          userId: user.userId,
          details: {
            batchNo: batch.batchNo,
            deletedCount: unlinkedItemIds.length,
            remainingCount: linkedItems.length,
          },
        },
      })
    })

    return successResponse({
      message: `Deleted ${unlinkedItemIds.length} unlinked items. ${linkedItems.length} linked items remain.`,
      deletedCount: unlinkedItemIds.length,
      remainingCount: linkedItems.length,
    })
  }

  // All items are unlinked - delete entire batch
  await prisma.$transaction(async (tx) => {
    const itemIds = batch.productItems.map((item) => item.id)

    // Delete QR tokens
    await tx.qRToken.deleteMany({
      where: { productItemId: { in: itemIds } },
    })

    // Delete product items
    await tx.productItem.deleteMany({
      where: { preGeneratedBatchId: id },
    })

    // Delete batch
    await tx.preGeneratedBatch.delete({
      where: { id },
    })

    // Log event
    await tx.eventLog.create({
      data: {
        eventType: 'PRE_GEN_DELETE',
        userId: user.userId,
        details: {
          batchNo: batch.batchNo,
          deletedCount: batch.quantity,
        },
      },
    })
  })

  return successResponse({
    message: `Batch ${batch.batchNo} deleted successfully`,
    deletedCount: batch.quantity,
  })
}

export const GET = withRoles(['ADMIN', 'WAREHOUSE'], handleGET)
export const DELETE = withRoles(['ADMIN'], handleDELETE)
