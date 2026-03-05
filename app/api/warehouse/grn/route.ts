import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { generateSerialNumber, generateGRNNumber } from '@/lib/serial-generator'
import { createQRToken, hashToken } from '@/lib/qr-token'
import type { InspectionStatus } from '@prisma/client'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

interface GRNLineInput {
  productMasterId: number  // Required - must select from ProductMaster
  quantity: number
  totalQty?: number  // NEW — planned total quantity (defaults to quantity if omitted)
  unitId: number
  lot?: string
  mfgDate?: string
  expDate?: string
  inspectionStatus?: InspectionStatus
  remarks?: string
  preGeneratedItemIds?: number[]  // Optional: use pre-generated QR items instead of creating new
}

interface CreateGRNInput {
  receivedAt: string
  warehouseId: number
  poNo?: string
  supplierName: string
  deliveryNoteNo?: string
  supplierAddress?: string
  supplierPhone?: string
  supplierContact?: string
  deliveryDocDate?: string
  remarks?: string
  lines: GRNLineInput[]
}

// GET /api/warehouse/grn - List GRNs
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const warehouseId = searchParams.get('warehouseId')
  const receivingStatus = searchParams.get('receivingStatus')

  const skip = (page - 1) * limit

  const where = {
    ...(search && {
      OR: [
        { grnNo: { contains: search, mode: 'insensitive' as const } },
        { supplierName: { contains: search, mode: 'insensitive' as const } },
        { poNo: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
    ...(receivingStatus && { receivingStatus: receivingStatus as 'PARTIAL' | 'COMPLETE' }),
  }

  const [grns, total] = await Promise.all([
    prisma.gRNHeader.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        rejectedBy: { select: { id: true, displayName: true } },
        _count: { select: { lines: true } },
        planLines: { select: { totalQty: true, receivedQty: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.gRNHeader.count({ where }),
  ])

  return successResponse({
    items: grns,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/warehouse/grn - Create GRN with lines
async function handlePOST(request: NextRequest, context: HandlerContext) {
  const body: CreateGRNInput = await request.json()
  const user = context.user

  // Validate required fields
  if (!body.receivedAt || !body.warehouseId || !body.supplierName || !body.lines?.length) {
    return errorResponse('Missing required fields: receivedAt, warehouseId, supplierName, lines')
  }

  // Validate warehouse exists
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: body.warehouseId },
  })

  if (!warehouse || !warehouse.isActive) {
    return errorResponse('Invalid warehouse')
  }

  try {
    // Calculate timeout based on total items (default 5s is too short for large batches)
    const totalItems = body.lines.reduce((sum, l) =>
      sum + (l.preGeneratedItemIds?.length || l.quantity), 0)
    const txTimeout = Math.max(30000, totalItems * 20)

    // Create GRN with lines in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate GRN number
      const grnNo = await generateGRNNumber()

      // Create GRN header
      const grnHeader = await tx.gRNHeader.create({
        data: {
          grnNo,
          receivedAt: new Date(body.receivedAt),
          receivedById: user.userId,
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

      // Create receiving session #1
      const receivingSession = await tx.gRNReceivingSession.create({
        data: {
          grnHeaderId: grnHeader.id,
          sessionNo: 1,
          receivedById: user.userId,
          receivedAt: new Date(body.receivedAt),
          itemCount: 0, // will update after creating lines
        },
      })

      // Create lines with product items and QR tokens
      const createdLines = []
      const planLineData: Array<{
        productMasterId: number
        totalQty: number
        receivedQty: number
        unitId: number
        lot?: string | null
        mfgDate?: Date | null
        expDate?: Date | null
        inspectionStatus: InspectionStatus
        remarks?: string | null
      }> = []

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

        const effectiveUnitId = line.unitId || productMaster.defaultUnitId || 1

        // Check if using pre-generated items
        if (line.preGeneratedItemIds && line.preGeneratedItemIds.length > 0) {
          const effectiveQty = line.preGeneratedItemIds.length
          const totalQty = line.totalQty ?? effectiveQty

          // Bulk fetch all pre-generated items at once (1 query instead of N)
          const preGenItems = await tx.productItem.findMany({
            where: { id: { in: line.preGeneratedItemIds } },
            include: {
              qrTokens: {
                where: { status: 'ACTIVE' },
                orderBy: { tokenVersion: 'desc' },
                take: 1,
              },
            },
          })

          // Validate all items exist
          if (preGenItems.length !== line.preGeneratedItemIds.length) {
            const foundIds = new Set(preGenItems.map(i => i.id))
            const missing = line.preGeneratedItemIds.find(id => !foundIds.has(id))
            throw new Error(`Pre-generated item not found: ${missing}`)
          }

          // Validate all items are linkable
          for (const preGenItem of preGenItems) {
            if (preGenItem.status !== 'PENDING_LINK') {
              throw new Error(`Item ${preGenItem.serial12} is not available for linking (status: ${preGenItem.status})`)
            }
            if (preGenItem.productMasterId && preGenItem.productMasterId !== productMaster.id) {
              throw new Error(`Pre-generated item ${preGenItem.serial12} belongs to a different product (ID: ${preGenItem.productMasterId}), expected product ID: ${productMaster.id}`)
            }
          }

          // Bulk update all product items at once (1 query instead of N)
          await tx.productItem.updateMany({
            where: { id: { in: line.preGeneratedItemIds } },
            data: {
              sku: productMaster.sku,
              name: productMaster.nameTh,
              categoryId: productMaster.categoryId,
              modelSize: productMaster.modelSize,
              productMasterId: productMaster.id,
              lot: line.lot || null,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
              expDate: line.expDate ? new Date(line.expDate) : null,
              status: 'IN_STOCK',
            },
          })

          // Batch increment linkedCount per batch (1 query per batch instead of per item)
          const batchCounts = new Map<number, number>()
          for (const item of preGenItems) {
            if (item.preGeneratedBatchId) {
              batchCounts.set(item.preGeneratedBatchId, (batchCounts.get(item.preGeneratedBatchId) || 0) + 1)
            }
          }
          for (const [batchId, count] of batchCounts) {
            await tx.preGeneratedBatch.update({
              where: { id: batchId },
              data: { linkedCount: { increment: count } },
            })
          }

          // Bulk create all GRN lines at once (1 query instead of N)
          await tx.gRNLine.createMany({
            data: preGenItems.map(item => ({
              grnHeaderId: grnHeader.id,
              productItemId: item.id,
              sku: productMaster.sku,
              itemName: productMaster.nameTh,
              modelSize: productMaster.modelSize,
              quantity: 1,
              unitId: effectiveUnitId,
              lot: line.lot || null,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
              expDate: line.expDate ? new Date(line.expDate) : null,
              inspectionStatus: (line.inspectionStatus || 'OK') as InspectionStatus,
              remarks: line.remarks || null,
              receivingSessionId: receivingSession.id,
            })),
          })

          // Bulk create all event logs at once (1 query instead of N)
          await tx.eventLog.createMany({
            data: preGenItems.map(item => ({
              eventType: 'INBOUND' as const,
              productItemId: item.id,
              userId: user.userId,
              details: {
                grnNo: grnHeader.grnNo,
                serialNumber: item.serial12,
                sku: productMaster.sku,
                productMasterId: productMaster.id,
                isPreGenerated: true,
                preGeneratedBatchId: item.preGeneratedBatchId,
              },
            })),
          })

          // Build response data from pre-fetched items
          for (const item of preGenItems) {
            createdLines.push({
              line: { id: item.id } as any,
              productItem: item,
              qrToken: item.qrTokens[0]?.token || '',
              isPreGenerated: true,
            })
          }

          // Collect plan line data
          planLineData.push({
            productMasterId: productMaster.id,
            totalQty,
            receivedQty: effectiveQty,
            unitId: effectiveUnitId,
            lot: line.lot || null,
            mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
            expDate: line.expDate ? new Date(line.expDate) : null,
            inspectionStatus: (line.inspectionStatus || 'OK') as InspectionStatus,
            remarks: line.remarks || null,
          })
        } else {
          // Normal flow: create new product items
          const effectiveQty = line.quantity
          const totalQty = line.totalQty ?? effectiveQty

          // Each quantity creates one product item (1 serial per item)
          for (let i = 0; i < effectiveQty; i++) {
            // Generate serial number with product info
            const serialNumber = await generateSerialNumber({
              activationType: productMaster.activationType,
              categorySerialCode: productMaster.category.serialCode,
              serialCode: productMaster.serialCode,
            })

            // Create product item linked to ProductMaster
            const productItem = await tx.productItem.create({
              data: {
                serial12: serialNumber,
                sku: productMaster.sku,
                name: productMaster.nameTh,
                categoryId: productMaster.categoryId,
                modelSize: productMaster.modelSize,
                productMasterId: productMaster.id,  // Link to ProductMaster
                lot: line.lot,
                mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
                expDate: line.expDate ? new Date(line.expDate) : null,
                status: 'IN_STOCK',
              },
            })

            // Create QR token for this product
            const qrToken = await createQRToken({
              serialNumber,
              productItemId: productItem.id,
              tokenVersion: 1,
              issuedAt: Math.floor(Date.now() / 1000),
            })

            // Store token and its hash
            await tx.qRToken.create({
              data: {
                productItemId: productItem.id,
                tokenVersion: 1,
                token: qrToken, // Store actual encrypted token
                tokenHash: hashToken(qrToken),
                status: 'ACTIVE',
              },
            })

            // Create GRN line with ProductMaster data
            const grnLine = await tx.gRNLine.create({
              data: {
                grnHeaderId: grnHeader.id,
                productItemId: productItem.id,
                sku: productMaster.sku,
                itemName: productMaster.nameTh,
                modelSize: productMaster.modelSize,
                quantity: 1, // Always 1 per line (1 serial)
                unitId: effectiveUnitId,
                lot: line.lot,
                mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
                expDate: line.expDate ? new Date(line.expDate) : null,
                inspectionStatus: line.inspectionStatus || 'OK',
                remarks: line.remarks,
                receivingSessionId: receivingSession.id,
              },
            })

            createdLines.push({
              line: grnLine,
              productItem,
              qrToken,
              isPreGenerated: false,
            })

            // Log event
            await tx.eventLog.create({
              data: {
                eventType: 'INBOUND',
                productItemId: productItem.id,
                userId: user.userId,
                details: {
                  grnNo: grnHeader.grnNo,
                  serialNumber,
                  sku: productMaster.sku,
                  productMasterId: productMaster.id,
                },
              },
            })
          }

          // Collect plan line data
          planLineData.push({
            productMasterId: productMaster.id,
            totalQty,
            receivedQty: effectiveQty,
            unitId: effectiveUnitId,
            lot: line.lot || null,
            mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
            expDate: line.expDate ? new Date(line.expDate) : null,
            inspectionStatus: (line.inspectionStatus || 'OK') as InspectionStatus,
            remarks: line.remarks || null,
          })
        }
      }

      // Create plan lines
      for (const pl of planLineData) {
        await tx.gRNPlanLine.create({
          data: {
            grnHeaderId: grnHeader.id,
            ...pl,
          },
        })
      }

      // Update receiving session item count
      await tx.gRNReceivingSession.update({
        where: { id: receivingSession.id },
        data: { itemCount: createdLines.length },
      })

      // Compute receiving status
      const isPartial = planLineData.some(pl => pl.receivedQty < pl.totalQty)
      if (isPartial) {
        await tx.gRNHeader.update({
          where: { id: grnHeader.id },
          data: { receivingStatus: 'PARTIAL' },
        })
      }

      return {
        grnHeader: { ...grnHeader, receivingStatus: isPartial ? 'PARTIAL' as const : 'COMPLETE' as const },
        lines: createdLines,
      }
    }, { timeout: txTimeout })

    return successResponse({
      id: result.grnHeader.id,
      grnNo: result.grnHeader.grnNo,
      receivingStatus: result.grnHeader.receivingStatus,
      linesCreated: result.lines.length,
      items: result.lines.map((l) => ({
        lineId: l.line.id,
        productItemId: l.productItem.id,
        serialNumber: l.productItem.serial12,
        qrToken: l.qrToken,
      })),
    }, 201)
  } catch (error) {
    console.error('Create GRN error:', error)
    return errors.internalError()
  }
}

export const GET = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const POST = withRoles(['ADMIN', 'WAREHOUSE'], handlePOST)
