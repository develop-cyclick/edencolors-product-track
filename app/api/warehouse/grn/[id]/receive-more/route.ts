import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { generateSerialNumber } from '@/lib/serial-generator'
import { createQRToken, hashToken } from '@/lib/qr-token'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

interface ReceiveMoreLineInput {
  planLineId: number
  quantity: number
  preGeneratedItemIds?: number[]
}

interface ReceiveMoreInput {
  receivedAt?: string
  remarks?: string
  lines: ReceiveMoreLineInput[]
}

// POST /api/warehouse/grn/[id]/receive-more
async function handlePOST(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params', 400)
  }

  const { id } = await context.params
  const grnId = parseInt(id)
  const body: ReceiveMoreInput = await request.json()
  const user = context.user

  if (isNaN(grnId)) {
    return errorResponse('Invalid GRN ID', 400)
  }

  if (!body.lines || body.lines.length === 0) {
    return errorResponse('No lines to receive', 400)
  }

  // Fetch GRN with plan lines
  const grn = await prisma.gRNHeader.findUnique({
    where: { id: grnId },
    include: {
      planLines: true,
      receivingSessions: {
        orderBy: { sessionNo: 'desc' },
        take: 1,
      },
    },
  })

  if (!grn) {
    return errors.notFound('GRN')
  }

  // Must be PARTIAL status
  if (grn.receivingStatus !== 'PARTIAL') {
    return errorResponse('GRN is already fully received', 400)
  }

  // Must be approved before receiving more
  if (!grn.approvedAt) {
    return errorResponse('GRN must be approved before receiving more items', 400)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Determine next session number
      const lastSessionNo = grn.receivingSessions[0]?.sessionNo || 0
      const newSessionNo = lastSessionNo + 1
      const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date()

      // Create new receiving session
      const session = await tx.gRNReceivingSession.create({
        data: {
          grnHeaderId: grnId,
          sessionNo: newSessionNo,
          receivedById: user.userId,
          receivedAt,
          itemCount: 0,
          remarks: body.remarks,
        },
      })

      const createdLines = []

      for (const inputLine of body.lines) {
        // Fetch plan line
        const planLine = grn.planLines.find(pl => pl.id === inputLine.planLineId)
        if (!planLine) {
          throw new Error(`Plan line not found: ${inputLine.planLineId}`)
        }

        // Determine effective quantity
        const effectiveQty = inputLine.preGeneratedItemIds?.length || inputLine.quantity
        const remaining = planLine.totalQty - planLine.receivedQty

        if (effectiveQty > remaining) {
          throw new Error(`Cannot receive ${effectiveQty} items for plan line ${inputLine.planLineId}. Remaining: ${remaining}`)
        }

        // Fetch product master
        const productMaster = await tx.productMaster.findUnique({
          where: { id: planLine.productMasterId },
          include: { category: true },
        })

        if (!productMaster) {
          throw new Error(`ProductMaster not found: ${planLine.productMasterId}`)
        }

        if (inputLine.preGeneratedItemIds && inputLine.preGeneratedItemIds.length > 0) {
          // Pre-generated items flow
          for (const preGenItemId of inputLine.preGeneratedItemIds) {
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

            if (preGenItem.productMasterId && preGenItem.productMasterId !== productMaster.id) {
              throw new Error(`Pre-generated item ${preGenItem.serial12} belongs to a different product`)
            }

            const productItem = await tx.productItem.update({
              where: { id: preGenItemId },
              data: {
                sku: productMaster.sku,
                name: productMaster.nameTh,
                categoryId: productMaster.categoryId,
                modelSize: productMaster.modelSize,
                productMasterId: productMaster.id,
                lot: planLine.lot,
                mfgDate: planLine.mfgDate,
                expDate: planLine.expDate,
                status: 'IN_STOCK',
              },
            })

            if (productItem.preGeneratedBatchId) {
              await tx.preGeneratedBatch.update({
                where: { id: productItem.preGeneratedBatchId },
                data: { linkedCount: { increment: 1 } },
              })
            }

            const qrToken = preGenItem.qrTokens[0]?.token || ''

            const grnLine = await tx.gRNLine.create({
              data: {
                grnHeaderId: grnId,
                productItemId: productItem.id,
                sku: productMaster.sku,
                itemName: productMaster.nameTh,
                modelSize: productMaster.modelSize,
                quantity: 1,
                unitId: planLine.unitId,
                lot: planLine.lot,
                mfgDate: planLine.mfgDate,
                expDate: planLine.expDate,
                inspectionStatus: planLine.inspectionStatus,
                remarks: planLine.remarks,
                receivingSessionId: session.id,
              },
            })

            createdLines.push({ line: grnLine, productItem, qrToken })

            await tx.eventLog.create({
              data: {
                eventType: 'INBOUND',
                productItemId: productItem.id,
                userId: user.userId,
                details: {
                  grnNo: grn.grnNo,
                  serialNumber: productItem.serial12,
                  sku: productMaster.sku,
                  productMasterId: productMaster.id,
                  isPreGenerated: true,
                  sessionNo: newSessionNo,
                  receiveMore: true,
                },
              },
            })
          }
        } else {
          // Normal flow: create new product items
          for (let i = 0; i < inputLine.quantity; i++) {
            const serialNumber = await generateSerialNumber({
              activationType: productMaster.activationType,
              categoryId: productMaster.categoryId,
              serialCode: productMaster.serialCode,
            })

            const productItem = await tx.productItem.create({
              data: {
                serial12: serialNumber,
                sku: productMaster.sku,
                name: productMaster.nameTh,
                categoryId: productMaster.categoryId,
                modelSize: productMaster.modelSize,
                productMasterId: productMaster.id,
                lot: planLine.lot,
                mfgDate: planLine.mfgDate,
                expDate: planLine.expDate,
                status: 'IN_STOCK',
              },
            })

            const qrToken = await createQRToken({
              serialNumber,
              productItemId: productItem.id,
              tokenVersion: 1,
              issuedAt: Math.floor(Date.now() / 1000),
            })

            await tx.qRToken.create({
              data: {
                productItemId: productItem.id,
                tokenVersion: 1,
                token: qrToken,
                tokenHash: hashToken(qrToken),
                status: 'ACTIVE',
              },
            })

            const grnLine = await tx.gRNLine.create({
              data: {
                grnHeaderId: grnId,
                productItemId: productItem.id,
                sku: productMaster.sku,
                itemName: productMaster.nameTh,
                modelSize: productMaster.modelSize,
                quantity: 1,
                unitId: planLine.unitId,
                lot: planLine.lot,
                mfgDate: planLine.mfgDate,
                expDate: planLine.expDate,
                inspectionStatus: planLine.inspectionStatus,
                remarks: planLine.remarks,
                receivingSessionId: session.id,
              },
            })

            createdLines.push({ line: grnLine, productItem, qrToken })

            await tx.eventLog.create({
              data: {
                eventType: 'INBOUND',
                productItemId: productItem.id,
                userId: user.userId,
                details: {
                  grnNo: grn.grnNo,
                  serialNumber,
                  sku: productMaster.sku,
                  productMasterId: productMaster.id,
                  sessionNo: newSessionNo,
                  receiveMore: true,
                },
              },
            })
          }
        }

        // Update plan line receivedQty
        await tx.gRNPlanLine.update({
          where: { id: planLine.id },
          data: { receivedQty: { increment: effectiveQty } },
        })
      }

      // Update session item count
      await tx.gRNReceivingSession.update({
        where: { id: session.id },
        data: { itemCount: createdLines.length },
      })

      // Reset approval status
      await tx.gRNHeader.update({
        where: { id: grnId },
        data: {
          approvedAt: null,
          approvedById: null,
          rejectedAt: null,
          rejectedById: null,
          rejectReason: null,
        },
      })

      // Recompute receiving status
      const updatedPlanLines = await tx.gRNPlanLine.findMany({
        where: { grnHeaderId: grnId },
      })
      const isComplete = updatedPlanLines.every(pl => pl.receivedQty >= pl.totalQty)

      await tx.gRNHeader.update({
        where: { id: grnId },
        data: { receivingStatus: isComplete ? 'COMPLETE' : 'PARTIAL' },
      })

      return {
        linesCreated: createdLines.length,
        sessionNo: newSessionNo,
        receivingStatus: isComplete ? 'COMPLETE' : 'PARTIAL',
      }
    })

    return successResponse({
      id: grnId,
      grnNo: grn.grnNo,
      ...result,
    })
  } catch (error) {
    console.error('Receive more error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to receive more items')
  }
}

export const POST = withRoles<RouteParams>(['ADMIN', 'WAREHOUSE'], handlePOST)
