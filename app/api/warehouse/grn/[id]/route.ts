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
        orderBy: { id: 'asc' },
      },
      planLines: {
        include: {
          productMaster: { select: { id: true, sku: true, nameTh: true, nameEn: true, modelSize: true } },
          unit: { select: { id: true, nameTh: true, nameEn: true } },
        },
        orderBy: { id: 'asc' },
      },
      receivingSessions: {
        include: {
          receivedBy: { select: { id: true, displayName: true } },
          lines: {
            include: {
              productItem: { select: { id: true, serial12: true, status: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { sessionNo: 'asc' },
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

  // Check if already approved (rejected GRNs CAN be edited)
  if (grn.approved_at) {
    return errorResponse('Cannot modify approved GRN', 400)
  }

  const wasRejected = !!grn.rejected_at

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

  // If GRN was rejected, clear rejection status to reset to pending
  if (wasRejected) {
    await prisma.$executeRaw`
      UPDATE grn_headers
      SET rejected_by_id = NULL,
          rejected_at = NULL,
          reject_reason = NULL,
          updated_at = ${new Date()}
      WHERE id = ${grnId}
    `
  }

  const updated = await prisma.gRNHeader.update({
    where: { id: grnId },
    data: updateData,
    include: {
      warehouse: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, displayName: true } },
    },
  })

  return successResponse({ grn: updated, statusReset: wasRejected })
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

// PUT /api/warehouse/grn/[id] - Full edit of GRN (delete old items and create new)
async function handlePUT(request: NextRequest, context: HandlerContext) {
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

  // Fetch existing GRN with lines
  const existingGrn = await prisma.gRNHeader.findUnique({
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

  if (!existingGrn) {
    return errors.notFound('GRN')
  }

  // Check if approved
  if (existingGrn.approvedAt) {
    return errorResponse('Cannot edit approved GRN', 400)
  }

  // Check rejection status using raw SQL
  const grnStatusResult = await prisma.$queryRaw<Array<{ rejected_at: Date | null }>>`
    SELECT rejected_at FROM grn_headers WHERE id = ${grnId}
  `
  const wasRejected = !!grnStatusResult[0]?.rejected_at

  // Check if any product has outbound
  const hasOutbound = existingGrn.lines.some(
    (line) => line.productItem.outboundLines.length > 0
  )

  if (hasOutbound) {
    return errorResponse('Cannot edit GRN with products that have outbound records', 400)
  }

  // Validate required fields
  if (!body.receivedAt || !body.warehouseId || !body.supplierName || !body.lines?.length) {
    return errorResponse('Missing required fields: receivedAt, warehouseId, supplierName, lines')
  }

  // Import serial generator functions
  const { generateSerialNumber } = await import('@/lib/serial-generator')
  const { createQRToken, hashToken } = await import('@/lib/qr-token')

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete existing data in reverse order
      const productItemIds = existingGrn.lines.map((line) => line.productItem.id)

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

      // 2. Update GRN header
      await tx.gRNHeader.update({
        where: { id: grnId },
        data: {
          receivedAt: new Date(body.receivedAt),
          warehouseId: body.warehouseId,
          poNo: body.poNo,
          supplierName: body.supplierName,
          deliveryNoteNo: body.deliveryNoteNo,
          supplierAddress: body.supplierAddress,
          supplierPhone: body.supplierPhone,
          supplierContact: body.supplierContact,
          deliveryDocDate: body.deliveryDocDate ? new Date(body.deliveryDocDate) : null,
          remarks: body.remarks,
        },
      })

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

      // 3. Create new lines with product items and QR tokens (same as POST logic)
      const createdLines = []

      for (const line of body.lines) {
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

        // Check if using pre-generated items
        if (line.preGeneratedItemIds && line.preGeneratedItemIds.length > 0) {
          // Use pre-generated items (link existing items)
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
              throw new Error(`Item ${preGenItem.serial12} is not available for linking`)
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
                inspectionStatus: line.inspectionStatus || 'OK',
                remarks: line.remarks,
              },
            })

            createdLines.push({ line: grnLine, productItem, qrToken })

            // Log event
            await tx.eventLog.create({
              data: {
                eventType: 'INBOUND',
                productItemId: productItem.id,
                userId: user.userId,
                details: {
                  grnNo: existingGrn.grnNo,
                  serialNumber: productItem.serial12,
                  sku: productMaster.sku,
                  isPreGenerated: true,
                  editedGrn: true,
                },
              },
            })
          }
        } else {
          // Normal flow: create new product items
          for (let i = 0; i < line.quantity; i++) {
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
                lot: line.lot,
                mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
                expDate: line.expDate ? new Date(line.expDate) : null,
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
                unitId: line.unitId || productMaster.defaultUnitId || 1,
                lot: line.lot,
                mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
                expDate: line.expDate ? new Date(line.expDate) : null,
                inspectionStatus: line.inspectionStatus || 'OK',
                remarks: line.remarks,
              },
            })

            createdLines.push({ line: grnLine, productItem, qrToken })

            // Log event
            await tx.eventLog.create({
              data: {
                eventType: 'INBOUND',
                productItemId: productItem.id,
                userId: user.userId,
                details: {
                  grnNo: existingGrn.grnNo,
                  serialNumber,
                  sku: productMaster.sku,
                  editedGrn: true,
                },
              },
            })
          }
        }
      }

      return { linesCreated: createdLines.length }
    })

    return successResponse({
      id: grnId,
      grnNo: existingGrn.grnNo,
      linesCreated: result.linesCreated,
      statusReset: wasRejected,
    })
  } catch (error) {
    console.error('Update GRN error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to update GRN')
  }
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePATCH)
export const PUT = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePUT)
export const DELETE = withRoles<RouteParams>(['ADMIN'], handleDELETE)
