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
  }

  const [grns, total] = await Promise.all([
    prisma.gRNHeader.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        _count: { select: { lines: true } },
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

      // Create lines with product items and QR tokens
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
            // Fetch and validate pre-generated item
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
                data: {
                  linkedCount: { increment: 1 },
                },
              })
            }

            // Get existing QR token
            const qrToken = preGenItem.qrTokens[0]?.token || ''

            // Create GRN line
            const grnLine = await tx.gRNLine.create({
              data: {
                grnHeaderId: grnHeader.id,
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

            createdLines.push({
              line: grnLine,
              productItem,
              qrToken,
              isPreGenerated: true,
            })

            // Log event
            await tx.eventLog.create({
              data: {
                eventType: 'INBOUND',
                productItemId: productItem.id,
                userId: user.userId,
                details: {
                  grnNo: grnHeader.grnNo,
                  serialNumber: productItem.serial12,
                  sku: productMaster.sku,
                  productMasterId: productMaster.id,
                  isPreGenerated: true,
                  preGeneratedBatchId: productItem.preGeneratedBatchId,
                },
              },
            })
          }
        } else {
          // Normal flow: create new product items
          // Each quantity creates one product item (1 serial per item)
          for (let i = 0; i < line.quantity; i++) {
            // Generate serial number
            const serialNumber = await generateSerialNumber()

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
                unitId: line.unitId || productMaster.defaultUnitId || 1,
                lot: line.lot,
                mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
                expDate: line.expDate ? new Date(line.expDate) : null,
                inspectionStatus: line.inspectionStatus || 'OK',
                remarks: line.remarks,
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
        }
      }

      return {
        grnHeader,
        lines: createdLines,
      }
    })

    return successResponse({
      id: result.grnHeader.id,
      grnNo: result.grnHeader.grnNo,
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
