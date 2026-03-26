import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

interface AddItemsLineInput {
  productMasterId: number
  unitId: number
  lot?: string
  mfgDate?: string
  expDate?: string
  remarks?: string
  preGeneratedItemIds: number[]
}

interface AddItemsInput {
  lines: AddItemsLineInput[]
}

// POST /api/warehouse/grn/[id]/add-items - Add new pre-generated items to existing GRN
async function handlePOST(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  const { id } = await context.params
  const grnId = parseInt(id)
  const body: AddItemsInput = await request.json()
  const user = context.user

  if (isNaN(grnId)) {
    return errorResponse('Invalid GRN ID', 400)
  }

  // Validate input
  if (!body.lines || body.lines.length === 0) {
    return errorResponse('No lines to add', 400)
  }

  // Check GRN exists and status using raw SQL
  const grnResult = await prisma.$queryRaw<Array<{
    id: number
    grn_no: string
    approved_at: Date | null
    rejected_at: Date | null
  }>>`
    SELECT id, grn_no, approved_at, rejected_at
    FROM grn_headers
    WHERE id = ${grnId}
  `

  if (grnResult.length === 0) {
    return errors.notFound('GRN')
  }

  const grn = grnResult[0]

  if (grn.approved_at) {
    return errorResponse('Cannot add items to approved GRN', 400)
  }

  const wasRejected = !!grn.rejected_at

  try {
    const result = await prisma.$transaction(async (tx) => {
      // If GRN was rejected, clear rejection status to reset to pending
      if (wasRejected) {
        await tx.$executeRaw`
          UPDATE grn_headers
          SET rejected_by_id = NULL,
              rejected_at = NULL,
              reject_reason = NULL,
              updated_at = ${new Date()}
          WHERE id = ${grnId}
        `
      }
      const createdLines = []

      for (const line of body.lines) {
        if (!line.preGeneratedItemIds || line.preGeneratedItemIds.length === 0) {
          continue
        }

        // Fetch ProductMaster data
        const productMaster = await tx.productMaster.findUnique({
          where: { id: line.productMasterId },
          include: { category: true, defaultUnit: true },
        })

        if (!productMaster) {
          throw new Error(`ProductMaster not found: ${line.productMasterId}`)
        }

        if (!productMaster.isActive) {
          throw new Error(`ProductMaster is inactive: ${productMaster.sku}`)
        }

        // Link pre-generated items
        for (const preGenItemId of line.preGeneratedItemIds) {
          const preGenItem = await tx.productItem.findUnique({
            where: { id: preGenItemId },
            include: {
              qrTokens: {
                where: { status: 'ACTIVE' },
                orderBy: { tokenVersion: 'desc' },
                take: 1,
              },
            },
          })

          if (!preGenItem) {
            throw new Error(`Pre-generated item not found: ${preGenItemId}`)
          }

          if (preGenItem.status !== 'PENDING_LINK') {
            throw new Error(`Item ${preGenItem.serial12} is not available for linking (status: ${preGenItem.status})`)
          }

          // Validate pre-gen item's productMasterId matches line's productMasterId
          if (preGenItem.productMasterId && preGenItem.productMasterId !== productMaster.id) {
            throw new Error(`Pre-generated item ${preGenItem.serial12} belongs to a different product`)
          }

          // Update pre-generated item with actual product data
          const productItem = await tx.productItem.update({
            where: { id: preGenItemId },
            data: {
              sku: productMaster.sku,
              name: productMaster.nameTh,
              categoryId: productMaster.categoryId,
              modelSize: productMaster.modelSize,
              productMasterId: productMaster.id,
              lot: line.lot,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
              expDate: line.expDate ? new Date(line.expDate) : null,
              status: 'IN_STOCK',
            },
          })

          // Update linked count on batch
          if (productItem.preGeneratedBatchId) {
            await tx.preGeneratedBatch.update({
              where: { id: productItem.preGeneratedBatchId },
              data: { linkedCount: { increment: 1 } },
            })
          }

          const qrToken = preGenItem.qrTokens[0]?.token || ''

          // Create GRN line
          const grnLine = await tx.gRNLine.create({
            data: {
              grnHeaderId: grnId,
              productItemId: productItem.id,
              sku: productMaster.sku,
              itemName: productMaster.nameTh,
              modelSize: productMaster.modelSize,
              quantity: 1,
              unitId: line.unitId || productMaster.defaultUnitId || 1,
              lot: line.lot,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
              expDate: line.expDate ? new Date(line.expDate) : null,
              remarks: line.remarks,
            },
          })

          createdLines.push({
            line: grnLine,
            productItem,
            qrToken,
          })

          // Log event
          await tx.eventLog.create({
            data: {
              eventType: 'INBOUND',
              productItemId: productItem.id,
              userId: user.userId,
              details: {
                grnNo: grn.grn_no,
                serialNumber: productItem.serial12,
                sku: productMaster.sku,
                productMasterId: productMaster.id,
                isPreGenerated: true,
                preGeneratedBatchId: productItem.preGeneratedBatchId,
                addedToExistingGrn: true,
              },
            },
          })
        }
      }

      return { linesCreated: createdLines.length }
    })

    return successResponse({
      id: grnId,
      grnNo: grn.grn_no,
      linesCreated: result.linesCreated,
      statusReset: wasRejected,
    })
  } catch (error) {
    console.error('Add items to GRN error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to add items')
  }
}

export const POST = withRoles<RouteParams>(['ADMIN', 'WAREHOUSE'], handlePOST)
